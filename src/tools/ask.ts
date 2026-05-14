// Tool handler for cesium_ask — publishes an interactive Q&A artifact.

import { createHash } from "node:crypto";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import { loadConfig, type CesiumConfig } from "../config.ts";
import { scrub } from "../render/scrub.ts";
import { extractTextContent } from "../render/extract.ts";
import { themeFromPreset, mergeTheme } from "../render/theme.ts";
import { validateAskInput } from "../render/validate.ts";
import { wrapDocument, type ArtifactMeta } from "../render/wrap.ts";
import type { InteractiveData } from "../render/validate.ts";
import { deriveProjectIdentity, artifactFilename, pathsFor } from "../storage/paths.ts";
import { atomicWrite } from "../storage/write.ts";
import { ensureThemeCss } from "../storage/assets.ts";
import { writeFaviconSvg } from "../storage/favicon-write.ts";
import { loadIndex, writeIndex, appendEntry, type IndexEntry } from "../storage/index-cache.ts";
import { withLock } from "../storage/lock.ts";
import { renderProjectIndex, renderGlobalIndex } from "../storage/index-gen.ts";
import { buildProjectSummaries } from "../storage/project-summaries.ts";
import {
  ensureServerRunning as defaultEnsureServerRunning,
  type RunningInfo,
  type LifecycleConfig,
} from "../server/lifecycle.ts";
import { buildTerminalSummary, resolveDisplayHost } from "./publish.ts";
import { getSessionModel } from "../session-model.ts";

export interface AskToolOverrides {
  loadConfig?: () => CesiumConfig;
  now?: () => Date;
  nanoid?: () => string;
  ensureRunning?: (cfg: LifecycleConfig) => Promise<RunningInfo | null>;
}

const TOOL_DESCRIPTION = `cesium_ask — Publish an interactive Q&A artifact and return its URL. Use this when you need
structured input from the user before producing a final artifact: design tradeoffs,
plan choices, confirmation gates, or any decision you'd otherwise type as a multi-choice
question into the terminal.

The artifact is a single self-contained .html file with the same look as cesium_publish
artifacts, plus interactive controls (radios, checkboxes, sliders, etc.). The user opens
the URL, clicks an answer, and the artifact crystallizes their choice into a permanent
record. After cesium_ask, call cesium_wait with the returned id to block until the user
finishes.

Question types: pick_one, pick_many, confirm, ask_text, slider, react. See cesium_styleguide
for the full schema.

DO NOT use for short yes/no questions you can ask in the terminal — those don't deserve
an artifact. Use cesium_ask for questions you'd want to remember later: shape decisions,
plan branches, design tradeoffs.`;

export function createAskTool(
  ctx: PluginInput,
  overrides?: AskToolOverrides,
): ReturnType<typeof tool> {
  const resolveConfig = overrides?.loadConfig ?? loadConfig;
  const now = overrides?.now ?? (() => new Date());
  const genId = overrides?.nanoid ?? defaultNanoid;
  const runEnsureRunning = overrides?.ensureRunning ?? defaultEnsureServerRunning;

  return tool({
    description: TOOL_DESCRIPTION,
    args: {
      title: tool.schema.string(),
      body: tool.schema.string(),
      questions: tool.schema.array(
        tool.schema.object({
          type: tool.schema.enum([
            "pick_one",
            "pick_many",
            "confirm",
            "ask_text",
            "slider",
            "react",
          ] as [string, ...string[]]),
          id: tool.schema.string(),
          question: tool.schema.string(),
          // All type-specific fields are optional; runtime validation handles them
          options: tool.schema
            .array(
              tool.schema.object({
                id: tool.schema.string(),
                label: tool.schema.string(),
                description: tool.schema.string().optional(),
              }),
            )
            .optional(),
          recommended: tool.schema.string().optional(),
          context: tool.schema.string().optional(),
          min: tool.schema.number().optional(),
          max: tool.schema.number().optional(),
          step: tool.schema.number().optional(),
          defaultValue: tool.schema.number().optional(),
          yesLabel: tool.schema.string().optional(),
          noLabel: tool.schema.string().optional(),
          multiline: tool.schema.boolean().optional(),
          placeholder: tool.schema.string().optional(),
          mode: tool.schema.enum(["approve", "thumbs"] as [string, ...string[]]).optional(),
          allowComment: tool.schema.boolean().optional(),
        }),
      ),
      summary: tool.schema.string().optional(),
      tags: tool.schema.array(tool.schema.string()).optional(),
      expiresAt: tool.schema.string().optional(),
      requireAll: tool.schema.boolean().optional(),
    },
    async execute(args, context) {
      // 1. Validate input
      const validation = validateAskInput(args);
      if (!validation.ok) {
        return `Error: ${validation.error}`;
      }
      const input = validation.value;

      // 2. Load config
      const config = resolveConfig();

      // 3. Probe git state
      const shell = ctx.$.cwd(ctx.directory).nothrow();
      let gitRemote: string | null = null;
      let gitBranch: string | null = null;
      let gitCommit: string | null = null;

      try {
        const remoteResult = await shell`git config --get remote.origin.url`.quiet();
        if (remoteResult.exitCode === 0) {
          gitRemote = remoteResult.text().trim() || null;
        }
      } catch {
        // not a git repo or no remote
      }

      try {
        const branchResult = await shell`git rev-parse --abbrev-ref HEAD`.quiet();
        if (branchResult.exitCode === 0) {
          gitBranch = branchResult.text().trim() || null;
        }
      } catch {
        // not a git repo
      }

      try {
        const commitResult = await shell`git rev-parse HEAD`.quiet();
        if (commitResult.exitCode === 0) {
          gitCommit = commitResult.text().trim() || null;
        }
      } catch {
        // not a git repo
      }

      // 4. Derive project identity
      const identity = deriveProjectIdentity({
        cwd: ctx.directory,
        gitRemote,
        worktree: ctx.worktree ?? null,
      });

      // 5. Generate id
      const id = genId();

      // 6. Timestamps
      const createdAt = now();

      // 7. Compute expiresAt and requireAll with defaults
      const expiresAt =
        input.expiresAt ?? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const requireAll = input.requireAll ?? true;

      // 8. Scrub body HTML
      const scrubbed = scrub(input.body);

      // 8a. Extract body text for full-text search
      const bodyText = extractTextContent(scrubbed.html);

      // 9. Content SHA-256 (over the body)
      const contentSha256 = createHash("sha256").update(scrubbed.html).digest("hex");

      // 10. Compute filename + paths
      const filename = artifactFilename({ title: input.title, id, createdAt });
      const paths = pathsFor({
        stateDir: config.stateDir,
        projectSlug: identity.slug,
        filename,
      });

      // 11. Build ArtifactMeta
      const meta: ArtifactMeta = {
        id,
        title: input.title,
        kind: "ask",
        summary: input.summary ?? null,
        tags: input.tags ?? [],
        createdAt: createdAt.toISOString(),
        model: getSessionModel(context.sessionID),
        sessionId: context.sessionID ?? null,
        projectSlug: identity.slug,
        projectName: identity.name,
        cwd: ctx.directory,
        worktree: identity.worktree,
        gitBranch,
        gitCommit,
        supersedes: null,
        supersededBy: null,
        contentSha256,
      };

      // 12. Build interactive data
      const interactive: InteractiveData = {
        kind: "ask",
        status: "open",
        requireAll,
        expiresAt,
        questions: input.questions,
        answers: {},
      };

      // 13. Build warnings
      const warnings: string[] = [];
      if (scrubbed.removed.length > 0) {
        warnings.push(`Removed ${scrubbed.removed.length} external resource(s) during scrub.`);
      }

      // 14. Build theme + wrap document
      const theme = mergeTheme(themeFromPreset(config.themePreset), config.theme);

      // 14a. Ensure theme.css + favicon.svg (idempotent, outside index lock — separate files)
      await ensureThemeCss(config.stateDir, theme);
      await writeFaviconSvg(config.stateDir);

      const fullHtml = wrapDocument({
        body: scrubbed.html,
        meta,
        theme,
        warnings,
        themeCssHref: "../../../theme.css",
        interactive,
      });

      // 15. Atomic write
      await atomicWrite(paths.artifactPath, fullHtml);

      // 16. Build IndexEntry
      const entry: IndexEntry = {
        id: meta.id,
        title: meta.title,
        kind: meta.kind,
        summary: meta.summary,
        tags: meta.tags,
        createdAt: meta.createdAt,
        filename,
        supersedes: null,
        supersededBy: null,
        gitBranch: meta.gitBranch,
        gitCommit: meta.gitCommit,
        contentSha256: meta.contentSha256,
        projectSlug: identity.slug,
        projectName: identity.name,
        bodyText,
      };

      const lockPath = join(config.stateDir, ".index.lock");

      await withLock({ lockPath }, async () => {
        // 17. Update per-project index
        const projectEntries = await loadIndex(paths.projectIndexJsonPath);
        const updatedProjectEntries = appendEntry(projectEntries, entry);
        await writeIndex(paths.projectIndexJsonPath, updatedProjectEntries);

        // 18. Update global index
        const globalEntries = await loadIndex(paths.globalIndexJsonPath);
        const updatedGlobalEntries = appendEntry(globalEntries, entry);
        await writeIndex(paths.globalIndexJsonPath, updatedGlobalEntries);

        // 19. Render and write project index.html
        const latestProjectEntries = await loadIndex(paths.projectIndexJsonPath);
        const projectIndexHtml = renderProjectIndex({
          projectSlug: identity.slug,
          projectName: identity.name,
          entries: latestProjectEntries,
          theme,
          themeCssHref: "../../theme.css",
        });
        await atomicWrite(paths.projectIndexPath, projectIndexHtml);

        // 20. Render and write global index.html
        const latestGlobalEntries = await loadIndex(paths.globalIndexJsonPath);
        const projectSummaries = buildProjectSummaries(latestGlobalEntries);
        const globalIndexHtml = renderGlobalIndex({
          projects: projectSummaries,
          theme,
          themeCssHref: "theme.css",
        });
        await atomicWrite(paths.globalIndexPath, globalIndexHtml);
      });

      // 21. Start server (best-effort) and build URLs
      let httpUrl: string | null = null;
      let serverInfo: RunningInfo | null = null;

      try {
        const maybeInfo = await runEnsureRunning({
          stateDir: config.stateDir,
          port: config.port,
          portMax: config.portMax,
          idleTimeoutMs: config.idleTimeoutMs,
          hostname: config.hostname,
          theme,
        });
        if (maybeInfo !== null) {
          serverInfo = maybeInfo;
          const liveDisplay = resolveDisplayHost(config.hostname);
          httpUrl = `http://${liveDisplay}:${serverInfo.port}${paths.serverPath}`;
        }
      } catch {
        httpUrl = null;
      }

      const terminalSummary = buildTerminalSummary({
        title: input.title,
        kind: "ask",
        httpUrl: httpUrl ?? paths.fileUrl,
        fileUrl: paths.fileUrl,
        isSsh: Boolean(process.env["SSH_CONNECTION"]),
        port: serverInfo?.port ?? config.port,
      });

      // 22. Return result
      const result = {
        id,
        filePath: paths.artifactPath,
        fileUrl: paths.fileUrl,
        httpUrl,
        terminalSummary,
      };

      return JSON.stringify(result, null, 2);
    },
  });
}

// Default nanoid implementation using built-in crypto for alphanumeric IDs
function defaultNanoid(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let result = "";
  for (const byte of bytes) {
    result += alphabet[byte % alphabet.length];
  }
  return result;
}

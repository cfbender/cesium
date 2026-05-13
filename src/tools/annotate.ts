// Tool handler for cesium_annotate — publishes an interactive review artifact.

import { createHash } from "node:crypto";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import { loadConfig, type CesiumConfig } from "../config.ts";
import { extractTextContent } from "../render/extract.ts";
import { themeFromPreset, mergeTheme } from "../render/theme.ts";
import { validateAnnotateInput, validateBlocksArray } from "../render/validate.ts";
import { renderBlocks } from "../render/blocks/render.ts";
import { resolveHighlightTheme } from "../render/blocks/highlight.ts";
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

export interface AnnotateToolOverrides {
  loadConfig?: () => CesiumConfig;
  now?: () => Date;
  nanoid?: () => string;
  ensureRunning?: (cfg: LifecycleConfig) => Promise<RunningInfo | null>;
}

const TOOL_DESCRIPTION = `cesium_annotate — Publish an interactive review artifact where the user can leave
per-line and per-block comments, plus a final verdict (Approve / Request changes / Comment).

Use this when reviewing diffs, plans, PRDs, code proposals, RFCs, audits, or design docs —
any content where chat-based feedback would be lossy. The artifact is a self-contained .html
file with a comment rail and a sticky verdict footer.

When NOT to use:
- Short yes/no approvals → use cesium_ask with a react question instead.
- One-way broadcasts with no feedback needed → use cesium_publish.

Workflow:
1. Call cesium_annotate → get back { id, filePath, fileUrl, httpUrl, terminalSummary }.
2. Call cesium_wait with the returned id to block until the user finishes their review.
3. If the user requests changes, revise and publish a new cesium_annotate (or cesium_publish)
   with supersedes pointing at the prior id.

Arguments:
- title: descriptive title (3–8 words).
- blocks: array of structured content blocks — all reviewable content lives here.
  Call cesium_styleguide for the full block catalog.
- verdictMode: "approve" | "approve-or-reject" | "full" (default: "full").
  "full" exposes Approve / Request changes / Comment buttons.
- perLineFor: block types that get per-line comment anchors (default: ["diff", "code"]).
- requireVerdict: whether the user must submit a verdict before completing (default: true).
- summary, tags, expiresAt: same semantics as cesium_publish.`;

export function createAnnotateTool(
  ctx: PluginInput,
  overrides?: AnnotateToolOverrides,
): ReturnType<typeof tool> {
  const resolveConfig = overrides?.loadConfig ?? loadConfig;
  const now = overrides?.now ?? (() => new Date());
  const genId = overrides?.nanoid ?? defaultNanoid;
  const runEnsureRunning = overrides?.ensureRunning ?? defaultEnsureServerRunning;

  return tool({
    description: TOOL_DESCRIPTION,
    args: {
      title: tool.schema.string(),
      blocks: tool.schema.array(tool.schema.any()),
      verdictMode: tool.schema
        .enum(["approve", "approve-or-reject", "full"] as [string, ...string[]])
        .optional(),
      perLineFor: tool.schema.array(tool.schema.string()).optional(),
      requireVerdict: tool.schema.boolean().optional(),
      summary: tool.schema.string().optional(),
      tags: tool.schema.array(tool.schema.string()).optional(),
      expiresAt: tool.schema.string().optional(),
    },
    async execute(args, _context) {
      // 1. Validate top-level input shape
      const validation = validateAnnotateInput(args);
      if (!validation.ok) {
        return `Error: ${validation.error}`;
      }
      const input = validation.value;

      // 2. Deep-validate block contents
      const blocksValidation = validateBlocksArray(input.blocks);
      if (!blocksValidation.ok) {
        const errorMessages = blocksValidation.errors
          .map((e) => `${e.path}: ${e.message}`)
          .join("; ");
        return `Error: blocks validation failed — ${errorMessages}`;
      }

      // 3. Load config
      const config = resolveConfig();

      // 4. Probe git state
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

      // 5. Derive project identity
      const identity = deriveProjectIdentity({
        cwd: ctx.directory,
        gitRemote,
        worktree: ctx.worktree ?? null,
      });

      // 6. Generate id + timestamps
      const id = genId();
      const createdAt = now();

      // 7. Defaults
      const expiresAt =
        input.expiresAt ?? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const requireVerdict = input.requireVerdict ?? true;
      const verdictMode = input.verdictMode ?? "full";
      const perLineFor = input.perLineFor ?? ["diff", "code"];

      // 8. Render blocks → trusted HTML (do NOT scrub — templated output is trusted)
      const highlightTheme = resolveHighlightTheme(config.themePreset);
      const bodyHtml = await renderBlocks(input.blocks, { highlightTheme });

      // 8a. Extract body text for full-text search
      const bodyText = extractTextContent(bodyHtml);

      // 9. Content SHA-256 over the rendered HTML
      const contentSha256 = createHash("sha256").update(bodyHtml).digest("hex");

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
        kind: "annotate",
        summary: input.summary ?? null,
        tags: input.tags ?? [],
        createdAt: createdAt.toISOString(),
        model: null,
        sessionId: null,
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
        kind: "annotate",
        status: "open",
        expiresAt,
        verdictMode,
        requireVerdict,
        perLineFor,
        comments: [],
        verdict: null,
      };

      // 13. Build theme + ensure theme.css and favicon
      const theme = mergeTheme(themeFromPreset(config.themePreset), config.theme);
      await ensureThemeCss(config.stateDir, theme);
      await writeFaviconSvg(config.stateDir);

      // 14. Wrap document
      const fullHtml = wrapDocument({
        body: bodyHtml,
        meta,
        theme,
        warnings: [],
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
        kind: "annotate",
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

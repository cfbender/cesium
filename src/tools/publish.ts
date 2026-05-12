// Tool handler for cesium_publish — validates input, delegates to render + storage.

import { createHash } from "node:crypto";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import { loadConfig, type CesiumConfig } from "../config.ts";
import { scrub } from "../render/scrub.ts";
import { extractTextContent } from "../render/extract.ts";
import { themeFromPreset, mergeTheme } from "../render/theme.ts";
import { validatePublishInput, htmlBodyWarnings, PUBLISH_KINDS } from "../render/validate.ts";
import { wrapDocument, type ArtifactMeta } from "../render/wrap.ts";
import { deriveProjectIdentity, artifactFilename, pathsFor } from "../storage/paths.ts";
import { atomicWrite, patchEmbeddedMetadata } from "../storage/write.ts";
import { ensureThemeCss } from "../storage/assets.ts";
import { writeFaviconSvg } from "../storage/favicon-write.ts";
import {
  loadIndex,
  writeIndex,
  appendEntry,
  patchEntry,
  type IndexEntry,
} from "../storage/index-cache.ts";
import { withLock } from "../storage/lock.ts";
import { renderProjectIndex, renderGlobalIndex } from "../storage/index-gen.ts";
import { buildProjectSummaries } from "../storage/project-summaries.ts";
import {
  ensureRunning as defaultEnsureRunning,
  type RunningInfo,
  type LifecycleConfig,
} from "../server/lifecycle.ts";

export interface PublishToolOverrides {
  loadConfig?: () => CesiumConfig;
  now?: () => Date;
  nanoid?: () => string;
  ensureRunning?: (cfg: LifecycleConfig) => Promise<RunningInfo | null>;
}

export interface TerminalSummaryArgs {
  title: string;
  kind: string;
  httpUrl: string;
  fileUrl: string;
  isSsh: boolean;
  port: number;
}

export function buildTerminalSummary(args: TerminalSummaryArgs): string {
  const { title, kind, httpUrl, fileUrl, isSsh, port } = args;
  let summary = `Cesium · ${title} (${kind})\n  ${httpUrl}\n  ${fileUrl}`;
  if (isSsh) {
    summary += `\n\n  (remote: forward port → ssh -L ${port}:localhost:${port} <host>)`;
  }
  return summary;
}

const TOOL_DESCRIPTION = `Publish a beautiful self-contained HTML document to the cesium artifacts directory.
Use this when responding with substantive content — plans, code reviews, comparisons,
reports, explainers, audits, design proposals — that the user is likely to re-read or share.

When to use cesium_publish (vs replying in terminal):
- Response would be ≥ ~400 words, OR
- Contains a comparison/decision matrix, OR
- Multi-section plan/PRD/RFC/design doc, OR
- Code review with > 3 findings, OR
- Anything the user might revisit later.

When to stay in the terminal: short factual answers, status updates ("done", "fixed",
"running tests"), mid-tool-call chatter, single-paragraph replies.

User overrides win: "/cesium" or "publish this" → publish; "in terminal" → don't.

The \`html\` argument is the BODY ONLY — do NOT include <!doctype>, <html>, <head>, <body>.
The plugin wraps your body with the design system.

Available CSS classes (call cesium_styleguide for full reference + examples):
- .eyebrow         uppercase mono micro-label above headings
- .h-display       page-title heading
- .h-section       section heading paired with .section-num
- .section-num     numbered chip ("01", "02") next to .h-section
- .card            bordered surface block (1.5px border, 12px radius)
- .tldr            clay-bordered summary box (use ONE per doc, near top)
- .callout         info box; modifiers: .callout.note .callout.warn .callout.risk
- .code            block-level code panel; inline highlights via .kw .str .cm .fn
- .timeline        milestone list with dots and connectors
- .diagram         wraps inline SVG with a caption below
- .compare-table   bordered comparison grid
- .risk-table      bordered risk-grid (likelihood/impact/mitigation columns)
- .kbd .pill .tag  inline chips
- .byline          rendered automatically as the footer

Inline \`style="..."\` and inline \`<svg>\` are encouraged for bespoke diagrams. NEVER reference
external resources: no <script src=>, no <link rel=stylesheet href=http>, no remote fonts,
no remote images. The plugin will silently strip external resources but the artifact will
look broken in the resulting render.

Title aim: 3-8 words, descriptive. Kind: pick the closest match.`;

export function createPublishTool(
  ctx: PluginInput,
  overrides?: PublishToolOverrides,
): ReturnType<typeof tool> {
  const resolveConfig = overrides?.loadConfig ?? loadConfig;
  const now = overrides?.now ?? (() => new Date());
  const genId = overrides?.nanoid ?? defaultNanoid;
  const runEnsureRunning = overrides?.ensureRunning ?? defaultEnsureRunning;

  return tool({
    description: TOOL_DESCRIPTION,
    args: {
      title: tool.schema.string(),
      kind: tool.schema.enum([...PUBLISH_KINDS] as [string, ...string[]]),
      html: tool.schema.string(),
      summary: tool.schema.string().optional(),
      tags: tool.schema.array(tool.schema.string()).optional(),
      supersedes: tool.schema.string().optional(),
    },
    async execute(args, _context) {
      // 1. Validate input
      const validation = validatePublishInput(args);
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

      // 7. Scrub
      const scrubbed = scrub(input.html);

      // 7a. Extract body text for full-text search
      const bodyText = extractTextContent(scrubbed.html);

      // 8. Compute filename + paths
      const filename = artifactFilename({ title: input.title, id, createdAt });
      const paths = pathsFor({
        stateDir: config.stateDir,
        projectSlug: identity.slug,
        filename,
      });

      // 9. Content SHA-256
      const contentSha256 = createHash("sha256").update(scrubbed.html).digest("hex");

      // 10. Build ArtifactMeta
      const meta: ArtifactMeta = {
        id,
        title: input.title,
        kind: input.kind,
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
        supersedes: input.supersedes ?? null,
        supersededBy: null,
        contentSha256,
      };

      // 11. Build warnings
      const warnings: string[] = [];
      if (scrubbed.removed.length > 0) {
        warnings.push(`Removed ${scrubbed.removed.length} external resource(s) during scrub.`);
      }
      const bodyWarnings = htmlBodyWarnings(scrubbed.html);
      for (const w of bodyWarnings) {
        warnings.push(w);
      }

      // 12. Build theme + wrap document
      const theme = mergeTheme(themeFromPreset(config.themePreset), config.theme);

      // 12a. Ensure theme.css + favicon.svg (idempotent, outside index lock — separate files)
      await ensureThemeCss(config.stateDir);
      await writeFaviconSvg(config.stateDir);

      const fullHtml = wrapDocument({
        body: scrubbed.html,
        meta,
        theme,
        warnings,
        themeCssHref: "../../../theme.css",
      });

      // 13. Atomic write
      await atomicWrite(paths.artifactPath, fullHtml);

      // 14. Build IndexEntry
      const entry: IndexEntry = {
        id: meta.id,
        title: meta.title,
        kind: meta.kind,
        summary: meta.summary,
        tags: meta.tags,
        createdAt: meta.createdAt,
        filename,
        supersedes: meta.supersedes,
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
        // 15. Update per-project index
        const projectEntries = await loadIndex(paths.projectIndexJsonPath);
        const updatedProjectEntries = appendEntry(projectEntries, entry);
        await writeIndex(paths.projectIndexJsonPath, updatedProjectEntries);

        // 16. Update global index
        const globalEntries = await loadIndex(paths.globalIndexJsonPath);
        const updatedGlobalEntries = appendEntry(globalEntries, entry);
        await writeIndex(paths.globalIndexJsonPath, updatedGlobalEntries);

        // 17. Handle supersedes chain
        if (input.supersedes) {
          const prevId = input.supersedes;
          const prevEntryIdx = updatedProjectEntries.findIndex((e) => e.id === prevId);
          if (prevEntryIdx !== -1) {
            const prevEntry = updatedProjectEntries[prevEntryIdx];
            if (prevEntry !== undefined) {
              const prevFilename = prevEntry.filename;
              const prevPaths = pathsFor({
                stateDir: config.stateDir,
                projectSlug: identity.slug,
                filename: prevFilename,
              });
              // Patch embedded metadata in the previous artifact file
              try {
                await patchEmbeddedMetadata(prevPaths.artifactPath, { supersededBy: id });
              } catch {
                // File may not exist on disk (e.g. cleaned up); log but don't fail
              }
              // Patch the index entry
              const patchedEntries = patchEntry(updatedProjectEntries, prevId, {
                supersededBy: id,
              });
              await writeIndex(paths.projectIndexJsonPath, patchedEntries);
            }
          }
          // If not found — publish still succeeds, warn is logged implicitly
        }

        // 18. Render and write project index.html
        const latestProjectEntries = await loadIndex(paths.projectIndexJsonPath);
        const projectIndexHtml = renderProjectIndex({
          projectSlug: identity.slug,
          projectName: identity.name,
          entries: latestProjectEntries,
          theme,
          themeCssHref: "../../theme.css",
        });
        await atomicWrite(paths.projectIndexPath, projectIndexHtml);

        // 19. Render and write global index.html
        const latestGlobalEntries = await loadIndex(paths.globalIndexJsonPath);
        const projectSummaries = buildProjectSummaries(latestGlobalEntries);
        const globalIndexHtml = renderGlobalIndex({
          projects: projectSummaries,
          theme,
          themeCssHref: "theme.css",
        });
        await atomicWrite(paths.globalIndexPath, globalIndexHtml);
      });

      // 20. Start server (best-effort) and build URLs
      const displayHost = resolveDisplayHost(config.hostname);
      let httpUrl = `http://${displayHost}:${config.port}${paths.serverPath}`;
      let indexUrl = `http://${displayHost}:${config.port}/projects/${identity.slug}/index.html`;
      let serverInfo: RunningInfo | null = null;

      try {
        const maybeInfo = await runEnsureRunning({
          stateDir: config.stateDir,
          port: config.port,
          portMax: config.portMax,
          idleTimeoutMs: config.idleTimeoutMs,
          hostname: config.hostname,
        });
        if (maybeInfo !== null) {
          serverInfo = maybeInfo;
          const liveDisplay = resolveDisplayHost(config.hostname);
          httpUrl = `http://${liveDisplay}:${serverInfo.port}${paths.serverPath}`;
          indexUrl = `http://${liveDisplay}:${serverInfo.port}/projects/${identity.slug}/index.html`;
        }
      } catch {
        // Server failed to start — proceed without; user can still use file:// URL.
      }

      const terminalSummary = buildTerminalSummary({
        title: input.title,
        kind: input.kind,
        httpUrl,
        fileUrl: paths.fileUrl,
        isSsh: Boolean(process.env["SSH_CONNECTION"]),
        port: serverInfo?.port ?? config.port,
      });

      // 21. Return result
      const result = {
        id,
        filePath: paths.artifactPath,
        fileUrl: paths.fileUrl,
        httpUrl,
        indexUrl,
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

// Pick a host for display URLs. When binding 0.0.0.0 (any-interface), substitute
// the first non-loopback IPv4 we can find so the URL is actually reachable from
// other machines on the LAN. For loopback/named bindings, just translate
// 127.0.0.1 to "localhost" for friendliness; everything else is used verbatim.
export function resolveDisplayHost(bindHost: string): string {
  if (bindHost === "0.0.0.0" || bindHost === "::") {
    const ifaces = networkInterfaces();
    for (const list of Object.values(ifaces)) {
      for (const iface of list ?? []) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
    return "localhost";
  }
  if (bindHost === "127.0.0.1" || bindHost === "::1") {
    return "localhost";
  }
  return bindHost;
}

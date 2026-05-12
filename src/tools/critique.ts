// Tool handler for cesium_critique — mode-aware body analyzer.
// Accepts either { html: string } (html mode) or { blocks: Block[] } (blocks mode). Exactly one required.

import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import {
  critiqueHtml,
  critiqueBlocks,
  type CritiqueResult,
  type CritiqueSeverity,
} from "../render/critique.ts";
import type { Block } from "../render/blocks/types.ts";

const TOOL_DESCRIPTION = `Analyze a draft HTML body for adherence to the cesium design
system before publishing. Returns a 0-100 score and findings (warn/suggest/info).

Call this on complex artifacts (>500 words, plans/comparisons/explainers) BEFORE
calling cesium_publish. Address warn-level findings; suggest-level findings are
optional but usually worth applying. info-level findings are FYI.

The 'html' argument is the same body you'd pass to cesium_publish — body inner
HTML only, no <!doctype>/<html>/<head>/<body> wrappers.`;

/**
 * Format a CritiqueResult into a concise human-readable string the agent can parse.
 * Format:
 *   score: 87/100
 *   mode: html
 *
 *   warn:
 *   - [external-resource] External resource will be stripped...
 *
 *   suggest:
 *   - [no-tldr] Long artifact with no .tldr summary...
 *
 *   info:
 *   - [code-without-highlights] Code blocks render without...
 */
export function formatCritiqueForAgent(result: CritiqueResult): string {
  const lines: string[] = [`score: ${result.score}/100`, `mode: ${result.mode}`];

  const bySeverity: Record<CritiqueSeverity, typeof result.findings> = {
    warn: [],
    suggest: [],
    info: [],
  };

  for (const f of result.findings) {
    bySeverity[f.severity].push(f);
  }

  for (const sev of ["warn", "suggest", "info"] as const) {
    const group = bySeverity[sev];
    if (group.length === 0) continue;
    lines.push("");
    lines.push(`${sev}:`);
    for (const f of group) {
      const pathSuffix = f.path !== undefined ? ` (${f.path})` : "";
      lines.push(`- [${f.code}] ${f.message}${pathSuffix}`);
    }
  }

  return lines.join("\n");
}

export function createCritiqueTool(_ctx: PluginInput): ReturnType<typeof tool> {
  return tool({
    description: TOOL_DESCRIPTION,
    args: {
      html: tool.schema.string().optional(),
      blocks: tool.schema.any().optional(),
    },
    async execute(args) {
      const hasHtml = args.html !== undefined && args.html !== null;
      const hasBlocks = args.blocks !== undefined && args.blocks !== null;

      if (hasHtml && hasBlocks) {
        return "error: provide exactly one of html or blocks, not both";
      }
      if (!hasHtml && !hasBlocks) {
        return "error: provide exactly one of html or blocks";
      }

      let result: CritiqueResult;

      if (hasHtml) {
        if (typeof args.html !== "string") {
          return "error: html must be a string";
        }
        result = critiqueHtml(args.html);
      } else {
        if (!Array.isArray(args.blocks)) {
          return "error: blocks must be an array";
        }
        result = critiqueBlocks(args.blocks as Block[]);
      }

      return formatCritiqueForAgent(result);
    },
  });
}

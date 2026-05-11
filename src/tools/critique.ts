// Tool handler for cesium_critique — runs the body analyzer and returns a human-readable report.

import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import { critique, type CritiqueResult, type CritiqueSeverity } from "../render/critique.ts";

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
  const lines: string[] = [`score: ${result.score}/100`];

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
      lines.push(`- [${f.code}] ${f.message}`);
    }
  }

  return lines.join("\n");
}

export function createCritiqueTool(_ctx: PluginInput): ReturnType<typeof tool> {
  return tool({
    description: TOOL_DESCRIPTION,
    args: { html: tool.schema.string() },
    async execute(args) {
      const result = critique(args.html);
      return formatCritiqueForAgent(result);
    },
  });
}

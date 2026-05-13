// Tool handler for cesium_critique — analyzes a draft blocks array.

import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import { critique, type CritiqueResult, type CritiqueSeverity } from "../render/critique.ts";
import type { Block } from "../render/blocks/types.ts";

const TOOL_DESCRIPTION = `Analyze a draft cesium artifact (blocks array) for adherence to the
cesium design system before publishing. Returns a 0-100 score and findings (warn/suggest/info).

Call this on substantive artifacts before \`cesium_publish\`. Address warn-level findings;
suggest-level findings are optional but usually worth applying. info-level findings are FYI.

The 'blocks' argument is the same array you'd pass to cesium_publish.`;

/**
 * Format a CritiqueResult into a concise human-readable string the agent can parse.
 * Format:
 *   score: 87/100
 *
 *   warn:
 *   - [raw-html-overuse] raw_html overuse: 3 raw_html blocks...
 *
 *   suggest:
 *   - [missing-tldr] Document has 6 sections but no tldr block...
 *
 *   info:
 *   - [code-without-meaningful-lang] Code block at ... uses lang "text"...
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
      blocks: tool.schema.any(),
    },
    async execute(args) {
      if (!Array.isArray(args.blocks)) {
        return "error: blocks must be an array";
      }
      const result = critique(args.blocks as Block[]);
      return formatCritiqueForAgent(result);
    },
  });
}

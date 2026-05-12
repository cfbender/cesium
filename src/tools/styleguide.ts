// Tool handler for cesium_styleguide — returns a markdown reference generated from the block catalog.

import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import { blockCatalog, blockTypes } from "../render/blocks/catalog.ts";
import { renderBlock } from "../render/blocks/render.ts";
import type { RenderCtx, SectionCounter } from "../render/blocks/render.ts";

function makeCtx(): RenderCtx {
  const counter: SectionCounter = { value: 1 };
  return { sectionCounter: counter, depth: 0, path: "blocks[0]", highlightTheme: "vitesse-dark" };
}

/** Escape a string for safe insertion inside a markdown fenced code block. */
function escapeForCodeFence(s: string): string {
  // Prevent accidental fence closing — replace ``` with ` `` ` (rare in practice)
  return s.replace(/```/g, "` `` `");
}

/** Generate the full markdown reference from the catalog. Deterministic — same catalog → same output. */
export async function generateStyleguideMarkdown(): Promise<string> {
  const lines: string[] = [];

  lines.push("# Cesium publishing reference");
  lines.push("");
  lines.push("## Two input modes");
  lines.push("");
  lines.push(
    "`cesium_publish` accepts either `blocks: Block[]` (preferred) or `html: string`" +
      " (escape valve). Provide exactly one.",
  );
  lines.push("");
  lines.push(
    "Prefer `blocks` for plans, reviews, reports, explainers, comparisons, audits, design docs." +
      " Use `html` only for whole-document bespoke layouts (custom hero, non-standard grid," +
      " experimental visual essay). For isolated bespoke regions, stay in `blocks` and use" +
      " `raw_html` or `diagram`.",
  );
  lines.push("");
  lines.push("## Block reference");
  lines.push("");

  // Pre-render all examples in parallel (order preserved via index)
  const renderedExamples = await Promise.all(
    blockTypes.map(async (blockType) => {
      const entry = blockCatalog[blockType];
      if (entry.renderedExample !== undefined) {
        return entry.renderedExample;
      }
      try {
        return await renderBlock(entry.example, makeCtx());
      } catch {
        return "";
      }
    }),
  );

  for (let i = 0; i < blockTypes.length; i++) {
    const blockType = blockTypes[i];
    if (blockType === undefined) continue;
    const entry = blockCatalog[blockType];
    const rendered = renderedExamples[i] ?? "";

    lines.push(`### \`${entry.type}\``);
    lines.push("");
    lines.push(entry.description);
    lines.push("");

    // Schema as JSON
    lines.push("```json");
    lines.push(escapeForCodeFence(JSON.stringify(entry.schema, null, 2)));
    lines.push("```");
    lines.push("");

    // Canonical example
    lines.push("Example:");
    lines.push("");
    lines.push("```json");
    lines.push(escapeForCodeFence(JSON.stringify(entry.example, null, 2)));
    lines.push("```");
    lines.push("");

    if (rendered !== "") {
      lines.push("Renders to:");
      lines.push("");
      lines.push("```html");
      lines.push(escapeForCodeFence(rendered));
      lines.push("```");
      lines.push("");
    }
  }

  lines.push(
    "## Markdown subset (inside `prose`, `tldr`, `callout.markdown`, list items, table cells)",
  );
  lines.push("");
  lines.push(
    "- Block: paragraph, `-` lists, `1.` lists, `>` blockquote, `---` rule, hard break (two-space EOL).",
  );
  lines.push(
    "- Inline: `**bold**`, `*italic*`, `` `code` ``, `[text](href)` (relative or anchor only).",
  );
  lines.push(
    "- HTML safelist: `<kbd>`, `<span class=\"pill\">`, `<span class=\"tag\">`. Anything else is escaped.",
  );
  lines.push("");
  lines.push("## When to reach for raw_html / diagram");
  lines.push("");
  lines.push(
    "- `diagram` — inline SVG visualizations or bespoke composed HTML diagrams.",
  );
  lines.push(
    "- `raw_html` — anything genuinely creative that doesn't fit a known block type." +
      " Include a `purpose` string describing what you're building.",
  );
  lines.push(
    "- Critique flags raw_html overuse (>2 blocks or >30% of body characters).",
  );

  return lines.join("\n");
}

export function createStyleguideTool(_ctx: PluginInput): ReturnType<typeof tool> {
  return tool({
    description:
      "Returns the cesium HTML design system reference page (CSS classes with example usage). Call this once at the start of writing a complex artifact to internalize the available components.",
    args: {},
    async execute(_args, _context) {
      return await generateStyleguideMarkdown();
    },
  });
}

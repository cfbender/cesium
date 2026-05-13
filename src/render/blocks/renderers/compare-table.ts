// CompareTable block renderer.
// src/render/blocks/renderers/compare-table.ts

import type { CompareTableBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { anchorAttr } from "../render.ts";
import { escapeHtml } from "../escape.ts";
import { renderMarkdown } from "../markdown.ts";

export function renderCompareTable(block: CompareTableBlock, ctx: RenderCtx): string {
  const headerCells = block.headers.map((h) => `      <th>${escapeHtml(h)}</th>`).join("\n");

  const bodyRows = block.rows
    .map((row) => {
      const cells = row
        .map((cell) => {
          const content = renderMarkdown(cell).replace(/^<p>|<\/p>$/g, "");
          return `      <td>${content}</td>`;
        })
        .join("\n");
      return `    <tr>\n${cells}\n    </tr>`;
    })
    .join("\n");

  return (
    `<table class="compare-table"${anchorAttr(ctx)}>\n` +
    `  <thead>\n    <tr>\n${headerCells}\n    </tr>\n  </thead>\n` +
    `  <tbody>\n${bodyRows}\n  </tbody>\n` +
    `</table>`
  );
}

export const meta: BlockMeta = {
  type: "compare_table",
  description:
    "Bordered comparison grid. Headers define columns; rows must have matching cell count.",
  schema: {
    type: "object",
    properties: {
      type: { const: "compare_table" },
      headers: { type: "array", items: { type: "string" } },
      rows: { type: "array", items: { type: "array", items: { type: "string" } } },
    },
    required: ["type", "headers", "rows"],
  },
  example: {
    type: "compare_table",
    headers: ["Feature", "html mode", "blocks mode"],
    rows: [
      ["Token cost", "High", "**~2× lower**"],
      ["Type safety", "None", "Full"],
      ["Escape hatch", "`raw_html`", "`raw_html`"],
    ],
  },
};

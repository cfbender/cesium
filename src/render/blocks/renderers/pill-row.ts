// PillRow block renderer.
// src/render/blocks/renderers/pill-row.ts

import type { PillRowBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { anchorAttr } from "../render.ts";
import { escapeHtml } from "../escape.ts";

export function renderPillRow(block: PillRowBlock, ctx: RenderCtx): string {
  const pills = block.items
    .map((item) => `  <span class="${item.kind}">${escapeHtml(item.text)}</span>`)
    .join("\n");
  return `<div class="pill-row"${anchorAttr(ctx)}>\n${pills}\n</div>`;
}

export const meta: BlockMeta = {
  type: "pill_row",
  description: "Horizontal row of pill or tag chips. Each item has a kind (pill or tag) and text.",
  schema: {
    type: "object",
    properties: {
      type: { const: "pill_row" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["pill", "tag"] },
            text: { type: "string" },
          },
          required: ["kind", "text"],
        },
      },
    },
    required: ["type", "items"],
  },
  example: {
    type: "pill_row",
    items: [
      { kind: "pill", text: "TypeScript" },
      { kind: "pill", text: "Bun" },
      { kind: "tag", text: "phase-2" },
    ],
  },
};

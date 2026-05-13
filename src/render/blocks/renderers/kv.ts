// KV block renderer.
// src/render/blocks/renderers/kv.ts

import type { KvBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { anchorAttr } from "../render.ts";
import { escapeHtml } from "../escape.ts";

export function renderKv(block: KvBlock, ctx: RenderCtx): string {
  const rows = block.rows
    .map((row) => `  <dt>${escapeHtml(row.k)}</dt><dd>${escapeHtml(row.v)}</dd>`)
    .join("\n");
  return `<dl class="kv"${anchorAttr(ctx)}>\n${rows}\n</dl>`;
}

export const meta: BlockMeta = {
  type: "kv",
  description: "Key-value metadata list. Renders as a definition list.",
  schema: {
    type: "object",
    properties: {
      type: { const: "kv" },
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            k: { type: "string" },
            v: { type: "string" },
          },
          required: ["k", "v"],
        },
      },
    },
    required: ["type", "rows"],
  },
  example: {
    type: "kv",
    rows: [
      { k: "Author", v: "AI Agent" },
      { k: "Status", v: "Draft" },
      { k: "Version", v: "2.0.0" },
    ],
  },
};

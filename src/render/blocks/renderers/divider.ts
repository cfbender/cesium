// Divider block renderer.
// src/render/blocks/renderers/divider.ts

import type { DividerBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { escapeAttr } from "../escape.ts";

export function renderDivider(block: DividerBlock, _ctx: RenderCtx): string {
  if (block.label !== undefined && block.label !== "") {
    return `<hr data-label="${escapeAttr(block.label)}">`;
  }
  return `<hr>`;
}

export const meta: BlockMeta = {
  type: "divider",
  description: "Horizontal rule separator, with an optional text label.",
  schema: {
    type: "object",
    properties: {
      type: { const: "divider" },
      label: { type: "string" },
    },
    required: ["type"],
  },
  example: {
    type: "divider",
    label: "End of Phase 1",
  },
};

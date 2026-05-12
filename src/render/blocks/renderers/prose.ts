// Prose block renderer.
// src/render/blocks/renderers/prose.ts

import type { ProseBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { renderMarkdown } from "../markdown.ts";

export function renderProse(block: ProseBlock, _ctx: RenderCtx): string {
  return renderMarkdown(block.markdown);
}

export const meta: BlockMeta = {
  type: "prose",
  description: "Free-form markdown text block. Renders paragraphs, lists, emphasis, links.",
  schema: {
    type: "object",
    properties: {
      type: { const: "prose" },
      markdown: { type: "string" },
    },
    required: ["type", "markdown"],
  },
  example: {
    type: "prose",
    markdown:
      "This is a paragraph with **bold** and *italic* text.\n\n- Item one\n- Item two",
  },
};

// Tldr block renderer.
// src/render/blocks/renderers/tldr.ts

import type { TldrBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { renderMarkdown } from "../markdown.ts";

export function renderTldr(block: TldrBlock, _ctx: RenderCtx): string {
  return `<aside class="tldr">\n${renderMarkdown(block.markdown)}\n</aside>`;
}

export const meta: BlockMeta = {
  type: "tldr",
  description:
    "Clay-bordered summary box. Use at most one per document, near the top. Content is markdown.",
  schema: {
    type: "object",
    properties: {
      type: { const: "tldr" },
      markdown: { type: "string" },
    },
    required: ["type", "markdown"],
  },
  example: {
    type: "tldr",
    markdown:
      "**Summary:** This document covers the block-mode refactor for `cesium_publish`. Three phases: plumbing, tooling flip, and cleanup.",
  },
};

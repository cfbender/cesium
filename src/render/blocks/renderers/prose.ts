// Prose block renderer.
// src/render/blocks/renderers/prose.ts

import type { ProseBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { anchorAttr } from "../render.ts";
import { renderMarkdown } from "../markdown.ts";

export function renderProse(block: ProseBlock, ctx: RenderCtx): string {
  const markdown = renderMarkdown(block.markdown);
  const anchor = anchorAttr(ctx);
  if (anchor === "") return markdown;
  // Inject the anchor attribute into the outermost element's opening tag.
  // renderMarkdown produces HTML starting with a tag like <p>, <ul>, <ol>, <blockquote>, <hr>.
  return markdown.replace(/^(<\w+)/, `$1${anchor}`);
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
    markdown: "This is a paragraph with **bold** and *italic* text.\n\n- Item one\n- Item two",
  },
};

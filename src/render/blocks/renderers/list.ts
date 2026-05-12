// List block renderer.
// src/render/blocks/renderers/list.ts

import type { ListBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { renderMarkdown } from "../markdown.ts";

export function renderList(block: ListBlock, _ctx: RenderCtx): string {
  const style = block.style ?? "bullet";

  const items = block.items
    .map((item) => {
      const content = renderMarkdown(item).replace(/^<p>|<\/p>$/g, "");
      return `  <li>${content}</li>`;
    })
    .join("\n");

  if (style === "number") {
    return `<ol>\n${items}\n</ol>`;
  } else if (style === "check") {
    const checkItems = block.items
      .map((item) => {
        const content = renderMarkdown(item).replace(/^<p>|<\/p>$/g, "");
        return `  <li class="check">${content}</li>`;
      })
      .join("\n");
    return `<ul class="check-list">\n${checkItems}\n</ul>`;
  } else {
    return `<ul>\n${items}\n</ul>`;
  }
}

export const meta: BlockMeta = {
  type: "list",
  description: "Bullet, numbered, or checklist. Items are markdown strings.",
  schema: {
    type: "object",
    properties: {
      type: { const: "list" },
      style: { type: "string", enum: ["bullet", "number", "check"] },
      items: { type: "array", items: { type: "string" } },
    },
    required: ["type", "items"],
  },
  example: {
    type: "list",
    style: "bullet",
    items: ["First item with **bold**", "Second item", "Third item"],
  },
};

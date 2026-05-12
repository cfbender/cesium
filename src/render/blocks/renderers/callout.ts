// Callout block renderer.
// src/render/blocks/renderers/callout.ts

import type { CalloutBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { escapeHtml } from "../escape.ts";
import { renderMarkdown } from "../markdown.ts";

export function renderCallout(block: CalloutBlock, _ctx: RenderCtx): string {
  const titleHtml =
    block.title !== undefined && block.title !== ""
      ? `<strong>${escapeHtml(block.title)}</strong> `
      : "";
  const contentHtml = renderMarkdown(block.markdown);
  return `<aside class="callout ${block.variant}">\n${titleHtml}${contentHtml}\n</aside>`;
}

export const meta: BlockMeta = {
  type: "callout",
  description: "Highlighted aside with variant styling. Variants: note, warn, risk.",
  schema: {
    type: "object",
    properties: {
      type: { const: "callout" },
      variant: { type: "string", enum: ["note", "warn", "risk"] },
      title: { type: "string" },
      markdown: { type: "string" },
    },
    required: ["type", "variant", "markdown"],
  },
  example: {
    type: "callout",
    variant: "warn",
    title: "Breaking Change",
    markdown: "This change removes the `html` fallback path. Migrate to `blocks` before upgrading.",
  },
};

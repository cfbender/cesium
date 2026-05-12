// Hero block renderer.
// src/render/blocks/renderers/hero.ts

import type { HeroBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { escapeHtml } from "../escape.ts";

export function renderHero(block: HeroBlock, _ctx: RenderCtx): string {
  const parts: string[] = [];

  if (block.eyebrow !== undefined && block.eyebrow !== "") {
    parts.push(`  <div class="eyebrow">${escapeHtml(block.eyebrow)}</div>`);
  }

  parts.push(`  <h1 class="h-display">${escapeHtml(block.title)}</h1>`);

  if (block.subtitle !== undefined && block.subtitle !== "") {
    parts.push(`  <p class="lede">${escapeHtml(block.subtitle)}</p>`);
  }

  if (block.meta !== undefined && block.meta.length > 0) {
    const rows = block.meta
      .map((row) => `    <dt>${escapeHtml(row.k)}</dt><dd>${escapeHtml(row.v)}</dd>`)
      .join("\n");
    parts.push(`  <dl class="kv">\n${rows}\n  </dl>`);
  }

  return `<header>\n${parts.join("\n")}\n</header>`;
}

export const meta: BlockMeta = {
  type: "hero",
  description: "Page title header with optional eyebrow, subtitle, and key-value metadata pairs.",
  schema: {
    type: "object",
    properties: {
      type: { const: "hero" },
      eyebrow: { type: "string" },
      title: { type: "string" },
      subtitle: { type: "string" },
      meta: {
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
    required: ["type", "title"],
  },
  example: {
    type: "hero",
    eyebrow: "Phase 2",
    title: "Block Mode Design",
    subtitle: "Structured input for cesium_publish",
    meta: [
      { k: "Status", v: "Draft" },
      { k: "Author", v: "AI" },
    ],
  },
};

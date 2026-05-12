// Section block renderer.
// src/render/blocks/renderers/section.ts

import type { SectionBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { renderBlock } from "../render.ts";
import { escapeHtml } from "../escape.ts";

export function renderSection(block: SectionBlock, ctx: RenderCtx): string {
  // Determine section number: explicit or auto-increment
  let num: string;
  if (block.num !== undefined && block.num !== "") {
    num = block.num;
  } else {
    num = String(ctx.sectionCounter.value).padStart(2, "0");
    ctx.sectionCounter.value += 1;
  }

  const parts: string[] = [];

  if (block.eyebrow !== undefined && block.eyebrow !== "") {
    parts.push(`  <div class="eyebrow">${escapeHtml(block.eyebrow)}</div>`);
  }

  parts.push(
    `  <h2 class="h-section"><span class="section-num">${escapeHtml(num)}</span> ${escapeHtml(block.title)}</h2>`,
  );

  // Render children with incremented depth
  const childCtx: RenderCtx = {
    sectionCounter: ctx.sectionCounter,
    depth: ctx.depth + 1,
    path: `${ctx.path}.children`,
  };
  for (let i = 0; i < block.children.length; i++) {
    const child = block.children[i];
    if (child === undefined) continue;
    const childBlockCtx: RenderCtx = {
      ...childCtx,
      path: `${ctx.path}.children[${i}]`,
    };
    parts.push(`  ${renderBlock(child, childBlockCtx)}`);
  }

  return `<section>\n${parts.join("\n")}\n</section>`;
}

export const meta: BlockMeta = {
  type: "section",
  description:
    "Numbered section with title and child blocks. Only block type with children. Nesting depth ≤ 3.",
  schema: {
    type: "object",
    properties: {
      type: { const: "section" },
      title: { type: "string" },
      num: { type: "string" },
      eyebrow: { type: "string" },
      children: { type: "array", items: { type: "object" } },
    },
    required: ["type", "title", "children"],
  },
  example: {
    type: "section",
    title: "Goals",
    eyebrow: "Why we're here",
    children: [
      {
        type: "prose",
        markdown: "Reduce output tokens by moving structural HTML into the server.",
      },
    ],
  },
};

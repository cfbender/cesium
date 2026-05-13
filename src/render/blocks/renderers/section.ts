// Section block renderer.
// src/render/blocks/renderers/section.ts

import type { SectionBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { renderBlock, anchorAttr } from "../render.ts";
import { escapeHtml } from "../escape.ts";

export async function renderSection(block: SectionBlock, ctx: RenderCtx): Promise<string> {
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

  // Render children with incremented depth.
  // Non-section children are grouped into <div class="card"> wrappers for visual polish.
  // Nested section children are emitted at top level (they carry their own card structure).
  // anchor: null — child blocks do not get their own block-N anchors; only the section is anchored.
  const childCtx: RenderCtx = {
    sectionCounter: ctx.sectionCounter,
    depth: ctx.depth + 1,
    path: `${ctx.path}.children`,
    highlightTheme: ctx.highlightTheme,
    anchor: null,
  };

  let buffer: string[] = [];

  for (let i = 0; i < block.children.length; i++) {
    const child = block.children[i];
    if (child === undefined) continue;
    const childBlockCtx: RenderCtx = {
      ...childCtx,
      path: `${ctx.path}.children[${i}]`,
    };
    // eslint-disable-next-line no-await-in-loop -- sequential render required; card buffer tracks contiguous non-section children
    const rendered = await renderBlock(child, childBlockCtx);
    if (child.type === "section") {
      // Flush buffered non-section children into a card first
      if (buffer.length > 0) {
        parts.push(`  <div class="card">\n${buffer.join("\n")}\n  </div>`);
        buffer = [];
      }
      parts.push(`  ${rendered}`);
    } else {
      buffer.push(`  ${rendered}`);
    }
  }

  // Flush any remaining non-section children
  if (buffer.length > 0) {
    parts.push(`  <div class="card">\n${buffer.join("\n")}\n  </div>`);
  }

  return `<section${anchorAttr(ctx)}>\n${parts.join("\n")}\n</section>`;
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

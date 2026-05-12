// Timeline block renderer.
// src/render/blocks/renderers/timeline.ts

import type { TimelineBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { escapeHtml } from "../escape.ts";

export function renderTimeline(block: TimelineBlock, _ctx: RenderCtx): string {
  const items = block.items
    .map((item) => {
      const dateHtml =
        item.date !== undefined && item.date !== ""
          ? ` <span class="timeline-date">${escapeHtml(item.date)}</span>`
          : "";
      return (
        `  <li class="timeline-item">\n` +
        `    <span class="timeline-label">${escapeHtml(item.label)}${dateHtml}</span>\n` +
        `    <span class="timeline-text">${escapeHtml(item.text)}</span>\n` +
        `  </li>`
      );
    })
    .join("\n");

  return `<ul class="timeline">\n${items}\n</ul>`;
}

export const meta: BlockMeta = {
  type: "timeline",
  description: "Milestone list with dot connectors. Each item has a label, text, and optional date.",
  schema: {
    type: "object",
    properties: {
      type: { const: "timeline" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            text: { type: "string" },
            date: { type: "string" },
          },
          required: ["label", "text"],
        },
      },
    },
    required: ["type", "items"],
  },
  example: {
    type: "timeline",
    items: [
      { label: "Phase 1", text: "CSS extraction and theme serving", date: "2026-05-10" },
      { label: "Phase 2", text: "Block plumbing and renderers", date: "2026-05-12" },
      { label: "Phase 3", text: "Tooling flip — prompt and styleguide update" },
    ],
  },
};

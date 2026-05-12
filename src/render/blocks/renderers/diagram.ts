// Diagram block renderer — escape-hatch for inline SVG or HTML diagrams.
// src/render/blocks/renderers/diagram.ts

import type { DiagramBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { escapeHtml } from "../escape.ts";
import { scrub } from "../../scrub.ts";

export function renderDiagram(block: DiagramBlock, _ctx: RenderCtx): string {
  const payload = block.svg ?? block.html ?? "";
  const scrubResult = scrub(payload);
  const scrubbed = scrubResult.html;

  const parts: string[] = [];
  parts.push(scrubbed);

  if (block.caption !== undefined && block.caption !== "") {
    parts.push(`<figcaption>${escapeHtml(block.caption)}</figcaption>`);
  }

  return `<figure class="diagram">\n${parts.join("\n")}\n</figure>`;
}

export const meta: BlockMeta = {
  type: "diagram",
  description:
    'Escape-hatch for inline SVG or bespoke HTML diagrams. Exactly one of svg or html required. Payload is scrubbed. For SVG, prefer fill="currentColor" and stroke="currentColor" so the diagram inherits the theme\'s text color. Use explicit colors only for emphasis (accents, warnings).',
  schema: {
    type: "object",
    properties: {
      type: { const: "diagram" },
      caption: { type: "string" },
      svg: { type: "string" },
      html: { type: "string" },
    },
    required: ["type"],
    oneOf: [{ required: ["svg"] }, { required: ["html"] }],
  },
  example: {
    type: "diagram",
    caption: "System architecture overview",
    svg: '<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="30" rx="4" fill="none" stroke="#888"/><text x="50" y="30" text-anchor="middle" font-size="12">cesium</text></svg>',
  },
};

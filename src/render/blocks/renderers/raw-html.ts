// RawHtml block renderer — escape-hatch for fully custom HTML payloads.
// src/render/blocks/renderers/raw-html.ts

import type { RawHtmlBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { scrub } from "../../scrub.ts";

export function renderRawHtml(block: RawHtmlBlock, _ctx: RenderCtx): string {
  const scrubResult = scrub(block.html);
  return scrubResult.html;
}

export const meta: BlockMeta = {
  type: "raw_html",
  description:
    "Fully custom HTML payload. Scrubbed of external resources. Use when no structured block fits. Include a purpose string for audit trail.",
  schema: {
    type: "object",
    properties: {
      type: { const: "raw_html" },
      html: { type: "string" },
      purpose: { type: "string" },
    },
    required: ["type", "html"],
  },
  example: {
    type: "raw_html",
    html: '<div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;"><div><h3>Option A</h3><p>Fast but brittle.</p></div><div><h3>Option B</h3><p>Slower but robust.</p></div></div>',
    purpose: "Two-column card layout not expressible as compare_table",
  },
};

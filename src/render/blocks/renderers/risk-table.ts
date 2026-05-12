// RiskTable block renderer.
// src/render/blocks/renderers/risk-table.ts

import type { RiskTableBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { escapeHtml } from "../escape.ts";

export function renderRiskTable(block: RiskTableBlock, _ctx: RenderCtx): string {
  const headerRow =
    "  <thead>\n    <tr>\n" +
    "      <th>Risk</th>\n      <th>Likelihood</th>\n      <th>Impact</th>\n      <th>Mitigation</th>\n" +
    "    </tr>\n  </thead>";

  const bodyRows = block.rows
    .map((row) => {
      return (
        `    <tr>\n` +
        `      <td>${escapeHtml(row.risk)}</td>\n` +
        `      <td class="risk-${escapeHtml(row.likelihood)}">${escapeHtml(row.likelihood)}</td>\n` +
        `      <td class="risk-${escapeHtml(row.impact)}">${escapeHtml(row.impact)}</td>\n` +
        `      <td>${escapeHtml(row.mitigation)}</td>\n` +
        `    </tr>`
      );
    })
    .join("\n");

  return (
    `<table class="risk-table">\n` +
    `${headerRow}\n` +
    `  <tbody>\n${bodyRows}\n  </tbody>\n` +
    `</table>`
  );
}

export const meta: BlockMeta = {
  type: "risk_table",
  description: "Risk register grid with likelihood/impact/mitigation columns.",
  schema: {
    type: "object",
    properties: {
      type: { const: "risk_table" },
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            risk: { type: "string" },
            likelihood: { type: "string", enum: ["low", "medium", "high"] },
            impact: { type: "string", enum: ["low", "medium", "high"] },
            mitigation: { type: "string" },
          },
          required: ["risk", "likelihood", "impact", "mitigation"],
        },
      },
    },
    required: ["type", "rows"],
  },
  example: {
    type: "risk_table",
    rows: [
      {
        risk: "Agent ignores blocks mode",
        likelihood: "high",
        impact: "high",
        mitigation: "Prompt steering + critique bonus + styleguide.",
      },
      {
        risk: "Markdown subset too narrow",
        likelihood: "low",
        impact: "medium",
        mitigation: "Audit first 50 artifacts; expand if needed.",
      },
    ],
  },
};

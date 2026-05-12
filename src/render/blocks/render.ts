// Block tree walker and dispatcher.
// src/render/blocks/render.ts

import type { Block } from "./types.ts";
import { renderHero } from "./renderers/hero.ts";
import { renderTldr } from "./renderers/tldr.ts";
import { renderSection } from "./renderers/section.ts";
import { renderProse } from "./renderers/prose.ts";
import { renderList } from "./renderers/list.ts";
import { renderCallout } from "./renderers/callout.ts";
import { renderCode } from "./renderers/code.ts";
import { renderTimeline } from "./renderers/timeline.ts";
import { renderCompareTable } from "./renderers/compare-table.ts";
import { renderRiskTable } from "./renderers/risk-table.ts";
import { renderKv } from "./renderers/kv.ts";
import { renderPillRow } from "./renderers/pill-row.ts";
import { renderDivider } from "./renderers/divider.ts";
import { renderDiagram } from "./renderers/diagram.ts";
import { renderRawHtml } from "./renderers/raw-html.ts";

/** Shared mutable counter — all section renderers increment this via the ctx ref. */
export interface SectionCounter {
  value: number;
}

/** Shared render context threaded through the tree walk. */
export interface RenderCtx {
  /** Shared auto-incrementing section counter (1-based). Mutable ref. */
  sectionCounter: SectionCounter;
  /** Current nesting depth (root = 0, inside section = 1, etc.). */
  depth: number;
  /** Path string for error messages (e.g. "blocks[2].children[1]"). */
  path: string;
}

function makeRootCtx(): RenderCtx {
  return {
    sectionCounter: { value: 1 },
    depth: 0,
    path: "blocks",
  };
}

/** Dispatch a single block to its renderer. */
export function renderBlock(block: Block, ctx: RenderCtx): string {
  switch (block.type) {
    case "hero":
      return renderHero(block, ctx);
    case "tldr":
      return renderTldr(block, ctx);
    case "section":
      return renderSection(block, ctx);
    case "prose":
      return renderProse(block, ctx);
    case "list":
      return renderList(block, ctx);
    case "callout":
      return renderCallout(block, ctx);
    case "code":
      return renderCode(block, ctx);
    case "timeline":
      return renderTimeline(block, ctx);
    case "compare_table":
      return renderCompareTable(block, ctx);
    case "risk_table":
      return renderRiskTable(block, ctx);
    case "kv":
      return renderKv(block, ctx);
    case "pill_row":
      return renderPillRow(block, ctx);
    case "divider":
      return renderDivider(block, ctx);
    case "diagram":
      return renderDiagram(block, ctx);
    case "raw_html":
      return renderRawHtml(block, ctx);
  }
}

/** Render an array of blocks, returning the concatenated HTML body string. */
export function renderBlocks(blocks: Block[], opts?: { title?: string }): string {
  const ctx = makeRootCtx();
  const parts: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block === undefined) continue;
    const blockCtx: RenderCtx = {
      ...ctx,
      path: `blocks[${i}]`,
    };
    parts.push(renderBlock(block, blockCtx));
  }
  // Unused opts.title kept for API compatibility; wrapDocument handles the title
  void opts;
  return parts.join("\n");
}

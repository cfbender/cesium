// Catalog — source of truth: aggregates meta from every renderer module.
// src/render/blocks/catalog.ts

import type { Block, BlockMeta } from "./types.ts";
import { meta as heroMeta } from "./renderers/hero.ts";
import { meta as tldrMeta } from "./renderers/tldr.ts";
import { meta as sectionMeta } from "./renderers/section.ts";
import { meta as proseMeta } from "./renderers/prose.ts";
import { meta as listMeta } from "./renderers/list.ts";
import { meta as calloutMeta } from "./renderers/callout.ts";
import { meta as codeMeta } from "./renderers/code.ts";
import { meta as timelineMeta } from "./renderers/timeline.ts";
import { meta as compareTableMeta } from "./renderers/compare-table.ts";
import { meta as riskTableMeta } from "./renderers/risk-table.ts";
import { meta as kvMeta } from "./renderers/kv.ts";
import { meta as pillRowMeta } from "./renderers/pill-row.ts";
import { meta as dividerMeta } from "./renderers/divider.ts";
import { meta as diagramMeta } from "./renderers/diagram.ts";
import { meta as rawHtmlMeta } from "./renderers/raw-html.ts";
import { meta as diffMeta } from "./renderers/diff.ts";

export const blockCatalog: Record<Block["type"], BlockMeta> = {
  hero: heroMeta,
  tldr: tldrMeta,
  section: sectionMeta,
  prose: proseMeta,
  list: listMeta,
  callout: calloutMeta,
  code: codeMeta,
  timeline: timelineMeta,
  compare_table: compareTableMeta,
  risk_table: riskTableMeta,
  kv: kvMeta,
  pill_row: pillRowMeta,
  divider: dividerMeta,
  diagram: diagramMeta,
  raw_html: rawHtmlMeta,
  diff: diffMeta,
};

export const blockTypes = Object.keys(blockCatalog) as Array<Block["type"]>;

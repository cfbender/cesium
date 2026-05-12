// Block discriminated union — the closed type system for cesium_publish structured input.
// src/render/blocks/types.ts

export type Block =
  | HeroBlock
  | TldrBlock
  | SectionBlock
  | ProseBlock
  | ListBlock
  | CalloutBlock
  | CodeBlock
  | TimelineBlock
  | CompareTableBlock
  | RiskTableBlock
  | KvBlock
  | PillRowBlock
  | DividerBlock
  | DiagramBlock
  | RawHtmlBlock;

export type HeroBlock = {
  type: "hero";
  eyebrow?: string;
  title: string;
  subtitle?: string;
  meta?: Array<{ k: string; v: string }>;
};

export type TldrBlock = {
  type: "tldr";
  // markdown subset; at most one tldr per document
  markdown: string;
};

export type SectionBlock = {
  type: "section";
  title: string;
  num?: string; // omitted = auto-numbered sequentially
  eyebrow?: string;
  children: Block[];
};

export type ProseBlock = {
  type: "prose";
  markdown: string;
};

export type ListBlock = {
  type: "list";
  style?: "bullet" | "number" | "check";
  items: string[]; // each item is markdown (subset)
};

export type CalloutBlock = {
  type: "callout";
  variant: "note" | "warn" | "risk";
  title?: string;
  markdown: string;
};

export type CodeBlock = {
  type: "code";
  lang: string; // required; "text" if unknown
  code: string;
  filename?: string;
  caption?: string;
};

export type TimelineBlock = {
  type: "timeline";
  items: Array<{ label: string; text: string; date?: string }>;
};

export type CompareTableBlock = {
  type: "compare_table";
  headers: string[];
  rows: string[][]; // cells are markdown (subset)
};

export type RiskTableBlock = {
  type: "risk_table";
  rows: Array<{
    risk: string;
    likelihood: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    mitigation: string;
  }>;
};

export type KvBlock = {
  type: "kv";
  rows: Array<{ k: string; v: string }>;
};

export type PillRowBlock = {
  type: "pill_row";
  items: Array<{ kind: "pill" | "tag"; text: string }>;
};

export type DividerBlock = {
  type: "divider";
  label?: string;
};

export type DiagramBlock = {
  type: "diagram";
  caption?: string;
  // exactly one of svg or html
  svg?: string;
  html?: string;
};

export type RawHtmlBlock = {
  type: "raw_html";
  html: string;
  purpose?: string; // brief reason; surfaced in critique findings
};

// ─── BlockMeta ───────────────────────────────────────────────────────────────

export type BlockMeta = {
  type: Block["type"];
  description: string;
  schema: object; // JSON Schema fragment for the block
  example: Block; // canonical example matching schema
  renderedExample?: string; // optional pre-rendered HTML for docs
};

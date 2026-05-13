// CSS framework and color token definitions — inlined into every artifact.

export interface ThemePalette {
  bg: string;
  surface: string;
  surface2: string;
  oat: string;
  rule: string;
  ink: string;
  inkSoft: string;
  muted: string;
  accent: string;
  olive: string;
  codeBg: string;
  codeFg: string;
  diffAdd: string; // line-tint and connector color for additions
  diffRemove: string; // line-tint and connector color for deletions
  diffChange: string; // connector color for replacements
}

export interface ThemeFonts {
  serif: string;
  sans: string;
  mono: string;
}

export interface ThemeTokens {
  colors: ThemePalette;
  fonts: ThemeFonts;
}

export type ThemePresetName =
  | "warm"
  | "cool"
  | "mono"
  | "paper"
  | "claret" // alias for claret-dark
  | "claret-dark"
  | "claret-light";

const STANDARD_FONTS: ThemeFonts = {
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Monaco, monospace',
};

export const THEME_PRESETS: Readonly<Record<ThemePresetName, ThemePalette>> = {
  // claret-dark: deep wine background with bright rose/sage — claret.nvim dark palette.
  "claret-dark": {
    bg: "#180810",
    surface: "#211618",
    surface2: "#2B1F22",
    oat: "#3A2E25",
    rule: "#3A2E25",
    ink: "#DDD3C7",
    inkSoft: "#BDB3A7",
    muted: "#9E9288",
    accent: "#C75B7A",
    olive: "#8FA86E",
    codeBg: "#2B1F22",
    codeFg: "#DDD3C7",
    diffAdd: "#6D9E60",
    diffRemove: "#C75B5B",
    diffChange: "#D4A85A",
  },
  // claret-light: deep-rose-on-warm-cream — derived from claret.nvim light palette.
  // (this is the old "claret" palette, now renamed)
  "claret-light": {
    bg: "#FDF8F3",
    surface: "#FFFFFF",
    surface2: "#F5EDE3",
    oat: "#E8DDD0",
    rule: "#D4C8B8",
    ink: "#2A1F1A",
    inkSoft: "#5A4D42",
    muted: "#7D7068",
    accent: "#8B2252",
    olive: "#5A6B40",
    codeBg: "#180810",
    codeFg: "#DDD3C7",
    diffAdd: "#5A6B40",
    diffRemove: "#9E3838",
    diffChange: "#B07A2A",
  },
  // claret: alias for claret-dark (backward compat)
  claret: {
    bg: "#180810",
    surface: "#211618",
    surface2: "#2B1F22",
    oat: "#3A2E25",
    rule: "#3A2E25",
    ink: "#DDD3C7",
    inkSoft: "#BDB3A7",
    muted: "#9E9288",
    accent: "#C75B7A",
    olive: "#8FA86E",
    codeBg: "#2B1F22",
    codeFg: "#DDD3C7",
    diffAdd: "#6D9E60",
    diffRemove: "#C75B5B",
    diffChange: "#D4A85A",
  },
  // Warm: ivory/clay/oat — the html-effectiveness reference palette.
  warm: {
    bg: "#FAF9F5",
    surface: "#FFFFFF",
    surface2: "#F0EEE6",
    oat: "#E3DACC",
    rule: "#D1CFC5",
    ink: "#141413",
    inkSoft: "#3D3D3A",
    muted: "#87867F",
    accent: "#D97757",
    olive: "#788C5D",
    codeBg: "#141413",
    codeFg: "#E8E6DE",
    diffAdd: "#788C5D",
    diffRemove: "#C0392B",
    diffChange: "#D97757",
  },
  // Cool: desaturated blue-grey — technical, trustworthy.
  cool: {
    bg: "#F4F6F9",
    surface: "#FFFFFF",
    surface2: "#E8ECF2",
    oat: "#D8DFE8",
    rule: "#C2C9D4",
    ink: "#141820",
    inkSoft: "#343B47",
    muted: "#7A8496",
    accent: "#3A7BB8",
    olive: "#4E8A6A",
    codeBg: "#1B2333",
    codeFg: "#D8E0ED",
    diffAdd: "#4E8A6A",
    diffRemove: "#B6443A",
    diffChange: "#3A7BB8",
  },
  // Mono: black/white/grey — editorial, high-contrast.
  mono: {
    bg: "#FBFAF8",
    surface: "#FFFFFF",
    surface2: "#F2F2F0",
    oat: "#E4E4E1",
    rule: "#CECECA",
    ink: "#111111",
    inkSoft: "#3A3A3A",
    muted: "#888884",
    accent: "#C0392B",
    olive: "#5A7A5A",
    codeBg: "#111111",
    codeFg: "#EBEBEB",
    diffAdd: "#5A7A5A",
    diffRemove: "#A03A2B",
    diffChange: "#666666",
  },
  // Paper: sepia/cream — soft, book-like, warm and aged.
  paper: {
    bg: "#F5EFE0",
    surface: "#FBF7EE",
    surface2: "#EDE4CF",
    oat: "#DDD0B8",
    rule: "#C9BFAA",
    ink: "#2A2218",
    inkSoft: "#4A3E32",
    muted: "#8A7E6E",
    accent: "#B05A2A",
    olive: "#607848",
    codeBg: "#2A2218",
    codeFg: "#E8DEC8",
    diffAdd: "#607848",
    diffRemove: "#A0392B",
    diffChange: "#B05A2A",
  },
};

export function isThemePresetName(name: string): name is ThemePresetName {
  return (
    name === "claret" ||
    name === "claret-dark" ||
    name === "claret-light" ||
    name === "warm" ||
    name === "cool" ||
    name === "mono" ||
    name === "paper"
  );
}

export function themeFromPreset(name?: string): ThemeTokens {
  const presetName: ThemePresetName =
    name !== undefined && isThemePresetName(name) ? name : "claret-dark";
  return {
    colors: THEME_PRESETS[presetName],
    fonts: STANDARD_FONTS,
  };
}

export function defaultTheme(): ThemeTokens {
  return themeFromPreset("claret-dark");
}

export function mergeTheme(base: ThemeTokens, override?: Partial<ThemePalette>): ThemeTokens {
  if (!override) return base;
  return {
    ...base,
    colors: { ...base.colors, ...override },
  };
}

export function themeToCssVars(theme: ThemeTokens): string {
  const { colors, fonts } = theme;
  return `:root {
  --bg: ${colors.bg};
  --surface: ${colors.surface};
  --surface-2: ${colors.surface2};
  --oat: ${colors.oat};
  --rule: ${colors.rule};
  --ink: ${colors.ink};
  --ink-soft: ${colors.inkSoft};
  --muted: ${colors.muted};
  --accent: ${colors.accent};
  --olive: ${colors.olive};
  --code-bg: ${colors.codeBg};
  --code-fg: ${colors.codeFg};
  --diff-add: ${colors.diffAdd};
  --diff-remove: ${colors.diffRemove};
  --diff-change: ${colors.diffChange};
  --serif: ${fonts.serif};
  --sans: ${fonts.sans};
  --mono: ${fonts.mono};
}`;
}

/** Returns ":root { --bg: ...; ... }" — token definitions only. */
export function themeTokensCss(theme: ThemeTokens): string {
  return themeToCssVars(theme);
}

/** Returns the framework's typography, components, layout — uses var(--bg) etc.
 *  Does NOT include any :root token definitions. Pure rules. */
export function frameworkRulesCss(): string {
  return `
/* reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; -webkit-text-size-adjust: 100%; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 1rem;
  line-height: 1.6;
  padding: clamp(20px, 4vw, 56px);
}
a { color: var(--accent); text-decoration: underline; }
a:hover { opacity: 0.8; }
img, svg { max-width: 100%; height: auto; }
p { margin-bottom: 1em; }
ul, ol { padding-left: 1.5em; margin-bottom: 1em; }

/* layout */
.page { max-width: 1120px; margin: 0 auto; }
section { margin-bottom: 64px; }

/* typography */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--serif);
  color: var(--ink);
  line-height: 1.2;
  margin-bottom: 0.5em;
}

/* eyebrow */
.eyebrow {
  font-family: var(--mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.5em;
}

/* headings */
.h-display {
  font-family: var(--serif);
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 700;
  line-height: 1.1;
  color: var(--ink);
  margin-bottom: 0.75em;
}
.h-section {
  font-family: var(--serif);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 0.5em;
}
.section-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--oat);
  color: var(--ink-soft);
  font-family: var(--mono);
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 6px;
  padding: 2px 7px;
  margin-right: 0.5em;
  vertical-align: middle;
}

/* card */
.card {
  background: var(--surface);
  border: 1.5px solid var(--rule);
  border-radius: 12px;
  padding: 18px 22px;
  margin-bottom: 1.5em;
  /* contain wide children (tables, long URLs, code) inside the card.
   * min-width:0 lets the card shrink in grid/flex contexts (.cards-grid)
   * so it actually obeys its track instead of growing to its widest child.
   * overflow-x:auto then scrolls any content that's STILL too wide
   * (e.g. a many-column table) rather than bursting the card border. */
  min-width: 0;
  overflow-x: auto;
}

/* tldr */
.tldr {
  background: var(--surface);
  border-left: 4px solid var(--accent);
  border-radius: 0 12px 12px 0;
  padding: 16px 20px;
  margin-bottom: 1.5em;
  font-size: 1.05rem;
  color: var(--ink-soft);
  min-width: 0;
  overflow-x: auto;
}

/* callout */
.callout {
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 1.25em;
  border: 1.5px solid var(--rule);
  background: var(--surface-2);
  color: var(--ink-soft);
  font-size: 0.95rem;
  min-width: 0;
  overflow-x: auto;
}
.callout.note { border-color: var(--olive); background: color-mix(in srgb, var(--olive) 10%, var(--surface)); }
.callout.warn { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
.callout.risk { border-color: #b45309; background: color-mix(in srgb, #b45309 10%, var(--surface)); }

/* code */
.code {
  background: var(--code-bg);
  color: var(--code-fg);
  font-family: var(--mono);
  font-size: 0.875rem;
  line-height: 1.6;
  border-radius: 8px;
  padding: 16px 20px;
  overflow-x: auto;
  margin-bottom: 1.25em;
  white-space: pre;
}
.code .kw { color: var(--accent); }
.code .str { color: var(--olive); }
.code .cm { color: var(--muted); font-style: italic; }
.code .fn { color: #d4a85a; }

/* figure.code — block-renderer code blocks (figure > figcaption + pre>code) */
figure.code {
  margin: 0 0 1.25em 0;
}
figure.code pre {
  background: var(--code-bg);
  color: var(--code-fg);
  font-family: var(--mono);
  font-size: 0.875rem;
  line-height: 1.6;
  border-radius: 8px;
  padding: 16px 20px;
  overflow-x: auto;
  margin: 0;
  white-space: pre;
}
figure.code pre code {
  font-family: inherit;
  font-size: inherit;
  background: none;
  padding: 0;
  color: inherit;
}
figure.code pre .kw { color: var(--accent); }
figure.code pre .str { color: var(--olive); }
figure.code pre .cm { color: var(--muted); font-style: italic; }
figure.code pre .fn { color: #d4a85a; }

/* timeline */
.timeline { list-style: none; padding: 0; position: relative; }
.timeline::before {
  content: "";
  position: absolute;
  left: 9px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--rule);
}
.timeline li {
  position: relative;
  padding-left: 32px;
  margin-bottom: 1.25em;
}
.timeline li::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 6px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--oat);
  border: 2px solid var(--accent);
}
/* timeline item inner spans */
.timeline-item { display: flex; flex-direction: column; gap: 0.15em; }
.timeline-label {
  font-family: var(--mono);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
}
.timeline-date {
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--muted);
  margin-left: 0.5em;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}
.timeline-text { color: var(--ink-soft); font-size: 0.95rem; }

/* diagram */
.diagram {
  border: 1.5px solid var(--rule);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  margin-bottom: 1.5em;
  background: var(--surface);
}
.diagram figcaption {
  font-size: 0.85rem;
  color: var(--muted);
  margin-top: 10px;
  font-family: var(--sans);
}
/* svg text/stroke/fill overrides — defense-in-depth for dark themes */
.diagram svg text,
figure.diagram svg text { fill: currentColor; }
.diagram svg [stroke="#888"],
.diagram svg [stroke="#999"],
.diagram svg [stroke="#666"] { stroke: currentColor; opacity: 0.55; }
.diagram svg [fill="#222"],
.diagram svg [fill="#000"],
.diagram svg [fill="black"] { fill: currentColor; }

/* kv — key-value definition list (hero meta, standalone kv block) */
dl.kv {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.4rem 1.5rem;
  margin: 1.25rem 0;
  align-items: baseline;
}
dl.kv dt {
  font-family: var(--mono);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
dl.kv dd { margin: 0; color: var(--ink-soft); }

/* lede — hero subtitle paragraph */
.lede {
  font-size: 1.15rem;
  color: var(--ink-soft);
  margin-bottom: 1em;
  line-height: 1.5;
}

/* divider — plain hr + labeled variant */
hr {
  border: none;
  border-top: 1.5px solid var(--rule);
  margin: 2em 0;
}
hr[data-label] {
  display: flex;
  align-items: center;
  gap: 0.75em;
  border: none;
  margin: 2em 0;
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
hr[data-label]::before {
  content: "";
  flex: 1;
  border-top: 1.5px solid var(--rule);
  display: block;
}
hr[data-label]::after {
  content: attr(data-label);
  flex-shrink: 0;
}

/* figure.code — caption above the code block */
figure.code figcaption {
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--muted);
  margin-bottom: 8px;
  letter-spacing: 0.04em;
}

/* pill-row — horizontal chip container */
.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  margin-bottom: 1.25em;
}

/* check-list — checklist style (ul style="check") */
.check-list {
  list-style: none;
  padding: 0;
  margin-bottom: 1em;
}
.check-list .check {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  margin-bottom: 0.4em;
  padding-left: 0.25em;
}
.check-list .check::before {
  content: "✓";
  font-family: var(--mono);
  font-size: 0.8em;
  font-weight: 700;
  color: var(--olive);
  flex-shrink: 0;
}

/* card stack — sibling cards within a section */
.card + .card { margin-top: 1em; }

/* compare-table */
.compare-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5em;
  font-size: 0.95rem;
}
.compare-table th, .compare-table td {
  border: 1.5px solid var(--rule);
  padding: 10px 14px;
  text-align: left;
  vertical-align: top;
  /* let long URLs / identifiers / paths wrap inside the cell instead of
   * pushing the table beyond its container. Many-column tables that are
   * still wider than the card fall through to the card's overflow-x. */
  overflow-wrap: anywhere;
  word-break: break-word;
}
.compare-table th {
  background: var(--surface-2);
  font-family: var(--sans);
  font-weight: 600;
  color: var(--ink);
}
.compare-table tr:nth-child(even) td { background: var(--surface-2); }

/* risk-table */
.risk-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5em;
  font-size: 0.95rem;
}
.risk-table th, .risk-table td {
  border: 1.5px solid var(--rule);
  padding: 10px 14px;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.risk-table th {
  background: var(--surface-2);
  font-family: var(--sans);
  font-weight: 600;
}
.risk-table td:first-child { font-weight: 600; color: var(--ink-soft); }

/* inline chips */
.kbd {
  display: inline-block;
  font-family: var(--mono);
  font-size: 0.8em;
  background: var(--surface-2);
  border: 1.5px solid var(--rule);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--ink-soft);
  white-space: nowrap;
}
.pill {
  display: inline-block;
  font-family: var(--sans);
  font-size: 0.8em;
  font-weight: 500;
  background: var(--oat);
  border-radius: 20px;
  padding: 2px 10px;
  color: var(--ink-soft);
  white-space: nowrap;
}
.tag {
  display: inline-block;
  font-family: var(--mono);
  font-size: 0.75em;
  font-weight: 600;
  background: var(--surface-2);
  border: 1px solid var(--rule);
  border-radius: 6px;
  padding: 2px 8px;
  color: var(--muted);
  text-transform: lowercase;
}
.pill.accent {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
  color: var(--accent);
  font-weight: 600;
}

/* ranked list — numbered cards for ordered recommendations / findings */
.ranked-list {
  display: flex;
  flex-direction: column;
  gap: 1em;
  margin: 0 0 1.5em;
  padding: 0;
  list-style: none;
}
.ranked-item {
  background: var(--surface);
  border: 1.5px solid var(--rule);
  border-radius: 12px;
  padding: 22px 26px;
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 6px 24px;
  align-items: start;
}
.ranked-item .rank-num {
  font-family: var(--serif);
  font-size: 2.4rem;
  font-weight: 500;
  color: var(--oat);
  line-height: 1;
  letter-spacing: -0.02em;
  padding-top: 2px;
}
.ranked-item .rank-title {
  font-family: var(--serif);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 6px;
  line-height: 1.3;
}
.ranked-item .rank-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.ranked-item .rank-body > p {
  color: var(--ink-soft);
  font-size: 0.95rem;
  line-height: 1.65;
  margin: 0 0 0.85em;
}
.ranked-item .rank-body > p:last-child { margin-bottom: 0; }
.ranked-item .rank-body > ul,
.ranked-item .rank-body > ol {
  color: var(--ink-soft);
  font-size: 0.95rem;
  line-height: 1.65;
  margin: 0 0 0.85em;
  padding-left: 1.2em;
}
.ranked-item .rank-aside {
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.6;
  padding-left: 14px;
  border-left: 2px solid var(--rule);
  margin: 0;
}
.ranked-item .rank-aside-label {
  font-family: var(--mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin-right: 6px;
}

/* byline */
.byline {
  border-top: 1.5px solid var(--rule);
  margin-top: 64px;
  padding-top: 18px;
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  gap: 1em;
  align-items: center;
}
.byline a { color: var(--muted); }

/* ─── interactive controls (.cs-*) ─────────────────────────────────────────── */

/* questions container */
.cs-questions { display: flex; flex-direction: column; gap: 1.5rem; margin: 2rem 0; }

/* individual question sections */
.cs-control-pick_one,
.cs-control-pick_many,
.cs-control-confirm,
.cs-control-ask_text,
.cs-control-slider,
.cs-control-react {
  background: var(--surface);
  border: 1.5px solid var(--rule);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* answered section — subtle left accent, slightly muted */
.cs-answered {
  background: var(--surface);
  border: 1.5px solid var(--rule);
  border-left: 3px solid var(--olive);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  opacity: 0.85;
}

/* pick buttons / labels */
.cs-pick {
  display: block;
  width: 100%;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border: 1.5px solid var(--rule);
  border-radius: 8px;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms, transform 120ms;
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.4;
}
.cs-pick:hover, .cs-pick:focus-visible {
  border-color: var(--accent);
  transform: translateY(-1px);
  outline: none;
}
.cs-pick-desc { color: var(--muted); font-size: 0.9em; margin-top: 0.25rem; }
.cs-recommended { border-color: color-mix(in srgb, var(--accent) 40%, var(--rule)); }

/* final/locked pick — no hover, accent border */
.cs-pick-final {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  cursor: default;
  transform: none !important;
}
.cs-pick-final:hover { transform: none; border-color: var(--accent); }

/* confirm buttons */
.cs-confirm-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.cs-confirm {
  min-width: 120px;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: 1.5px solid var(--rule);
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 120ms, transform 120ms;
}
.cs-confirm:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
.cs-yes {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}
.cs-no {
  background: var(--surface);
  color: var(--ink);
  border-color: var(--rule);
}
.cs-confirm-final { cursor: default; transform: none !important; }
.cs-confirm-final:hover { opacity: 1; transform: none; }

/* text input / textarea */
.cs-text {
  display: block;
  width: 100%;
  padding: 0.625rem 0.875rem;
  background: var(--surface-2);
  border: 1.5px solid var(--rule);
  border-radius: 8px;
  color: var(--ink);
  font-family: var(--sans);
  font-size: 1rem;
  line-height: 1.5;
  transition: border-color 120ms;
  resize: vertical;
}
.cs-text:focus { border-color: var(--accent); outline: none; }
textarea.cs-text { font-family: var(--mono); }

/* answered text */
.cs-answered-text {
  border-left: 3px solid var(--accent);
  margin: 0;
  padding: 0.5rem 1rem;
  color: var(--ink-soft);
  font-size: 0.95rem;
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
  border-radius: 0 8px 8px 0;
}

/* slider */
.cs-slider { width: 100%; accent-color: var(--accent); cursor: pointer; }
.cs-slider-out {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: var(--surface-2);
  border-radius: 6px;
  font-family: var(--mono);
  font-weight: 600;
  font-size: 0.9em;
}
.cs-slider-final { font-size: 1rem; color: var(--ink-soft); }
.cs-slider-final strong { color: var(--ink); font-family: var(--mono); }

/* react buttons */
.cs-react-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.cs-react {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1.5px solid var(--rule);
  background: var(--surface);
  color: var(--ink);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 120ms, opacity 120ms;
}
.cs-react:hover:not(:disabled) { border-color: var(--accent); opacity: 0.9; }
.cs-react-comment { /* same as cs-text textarea */ }

/* optional comment display */
.cs-comment {
  color: var(--ink-soft);
  font-size: 0.9rem;
  font-style: italic;
  margin-top: 0.25rem;
}

/* context prose */
.cs-context { color: var(--muted); font-size: 0.9rem; margin-bottom: 0; }

/* submit button */
.cs-submit {
  align-self: flex-start;
  padding: 0.6rem 1.5rem;
  background: var(--accent);
  color: var(--bg);
  border: 1.5px solid var(--accent);
  border-radius: 8px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 120ms;
}
.cs-submit:hover:not(:disabled) { opacity: 0.85; }
.cs-submit:disabled { opacity: 0.4; cursor: not-allowed; }

/* skip button — secondary, less prominent than submit */
.cs-skip {
  align-self: flex-start;
  padding: 0.6rem 1.5rem;
  background: var(--surface-2);
  color: var(--muted);
  border: 1.5px solid var(--rule);
  border-radius: 8px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 120ms, border-color 120ms;
}
.cs-skip:hover:not(:disabled) { opacity: 0.85; border-color: var(--muted); }
.cs-skip:disabled { opacity: 0.4; cursor: not-allowed; }

/* button row — submit + skip side by side */
.cs-button-row { display: flex; gap: 0.75rem; align-items: baseline; flex-wrap: wrap; }

/* answered-skipped placeholder */
.cs-answered-skipped { color: var(--muted); font-style: italic; font-size: 0.9rem; }

/* pending / saving state */
.cs-saving { opacity: 0.6; pointer-events: none; }

/* inline error */
.cs-error {
  color: #c93b3b;
  padding: 0.5rem 0.75rem;
  background: color-mix(in srgb, #c93b3b 10%, transparent);
  border: 1.5px solid currentColor;
  border-radius: 6px;
  font-size: 0.9rem;
}

/* session-ended banner */
.cs-banner-ended {
  max-width: var(--content-width, 70ch);
  margin: 16px auto 24px;
  padding: 0.5rem 0.875rem;
  background: color-mix(in srgb, var(--accent) 10%, var(--bg));
  border-radius: 8px;
  text-align: left;
  font-weight: 600;
  font-size: 0.9rem;
}

/* ─── annotate affordances (.cs-anchor-*) ─────────────────────────────────── */

/* affordance base — hidden by default, shown on anchor hover/focus */
.cs-anchor-affordance {
  display: none;
  cursor: pointer;
  border: none;
  background: none;
  padding: 0;
  line-height: 1;
  color: var(--muted);
  transition: color 120ms, background 120ms, opacity 120ms;
  min-width: 36px;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 16px;
  flex-shrink: 0;
}
.cs-anchor-affordance:hover {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}
/* show affordance on anchor hover / focus-within */
[data-cesium-anchor]:hover > .cs-anchor-affordance,
[data-cesium-anchor]:focus-within > .cs-anchor-affordance {
  display: inline-flex;
}

/* line affordance — tight gutter "+" icon */
.cs-anchor-affordance-line {
  font-size: 14px;
  min-width: 24px;
  min-height: 24px;
  margin-right: 4px;
}

/* block affordance — pencil icon to the left of block-level elements */
.cs-anchor-affordance-block {
  font-size: 15px;
  margin-right: 8px;
}

/* ─── annotate comment popup (.cs-comment-popup) ───────────────────────────── */

.cs-comment-popup {
  position: absolute;
  z-index: 100;
  width: 360px;
  max-width: calc(100vw - 32px);
  background: var(--surface);
  border: 1.5px solid var(--rule);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 32px color-mix(in srgb, var(--ink) 18%, transparent);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cs-comment-popup-quote {
  font-size: 0.85rem;
  color: var(--muted);
  font-style: italic;
  border-left: 3px solid var(--rule);
  padding: 4px 10px;
  margin: 0;
  white-space: pre-wrap;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}
.cs-comment-input {
  display: block;
  width: 100%;
  min-height: 80px;
  padding: 0.625rem 0.875rem;
  background: var(--surface-2);
  border: 1.5px solid var(--rule);
  border-radius: 8px;
  color: var(--ink);
  font-family: var(--sans);
  font-size: 0.9rem;
  line-height: 1.5;
  resize: vertical;
  transition: border-color 120ms;
}
.cs-comment-input:focus { border-color: var(--accent); outline: none; }
.cs-comment-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.cs-comment-save {
  padding: 0.45rem 1.1rem;
  background: var(--accent);
  color: var(--bg);
  border: 1.5px solid var(--accent);
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 120ms;
}
.cs-comment-save:hover:not(:disabled) { opacity: 0.85; }
.cs-comment-save:disabled { opacity: 0.4; cursor: not-allowed; }
.cs-comment-cancel {
  padding: 0.45rem 1rem;
  background: var(--surface-2);
  color: var(--muted);
  border: 1.5px solid var(--rule);
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 120ms, border-color 120ms;
}
.cs-comment-cancel:hover:not(:disabled) { opacity: 0.85; border-color: var(--muted); }
.cs-comment-cancel:disabled { opacity: 0.4; cursor: not-allowed; }

/* ─── comment rail (.cs-comment-rail) ─────────────────────────────────────── */

/* Body is the absolute-positioning context for the rail */
body { position: relative; }

.cs-comment-rail {
  position: absolute;
  right: 24px;
  top: 0;
  width: 280px;
  display: flex;
  flex-direction: column;
  z-index: 50;
}
@media (max-width: 900px) {
  .cs-comment-rail {
    position: static;
    width: 100%;
    max-height: none;
    margin-top: 24px;
  }
}
.cs-comment-bubble {
  position: absolute;
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1.5px solid var(--rule);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 120ms;
}
/* connector pseudo-element: dotted line from bubble leading edge leftward */
.cs-comment-bubble::before {
  content: "";
  position: absolute;
  top: 14px;
  left: -24px;
  width: 24px;
  border-top: 1px dotted var(--rule);
  opacity: 0;
  transition: opacity 120ms;
}
.cs-comment-bubble:hover::before,
.cs-comment-bubble-active::before {
  opacity: 1;
}
.cs-comment-bubble:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--rule)); }
.cs-comment-bubble-active {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--rule));
}
/* anchor highlight when its bubble is active */
.cs-anchor-active {
  background-color: color-mix(in srgb, var(--accent) 8%, transparent) !important;
  transition: background-color 120ms;
}
.cs-comment-bubble-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.cs-comment-anchor-label {
  font-family: var(--mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cs-comment-delete {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1.5px solid transparent;
  background: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 120ms, background 120ms, border-color 120ms;
  padding: 0;
  line-height: 1;
}
.cs-comment-delete:hover {
  color: #c93b3b;
  background: color-mix(in srgb, #c93b3b 10%, transparent);
  border-color: #c93b3b;
}
.cs-comment-text {
  font-size: 0.9rem;
  color: var(--ink);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.cs-comment-bubble-quote {
  font-size: 0.8rem;
  color: var(--muted);
  font-style: italic;
  border-left: 2px solid var(--rule);
  padding: 2px 8px;
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

/* ─── verdict footer (.cs-verdict-footer) ─────────────────────────────────── */

/* extra body padding when annotate scaffold is present, so footer doesn't
   cover content. Fallback class .cs-annotate-active added by client JS. */
body:has(.cs-annotate-scaffold),
body.cs-annotate-active {
  padding-bottom: 80px;
}
.cs-verdict-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--bg);
  border-top: 1.5px solid var(--rule);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(16px, 4vw, 48px);
  z-index: 60;
  gap: 12px;
}
.cs-comment-count {
  font-family: var(--mono);
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
}
.cs-verdict-btn {
  padding: 0.5rem 1.2rem;
  border-radius: 8px;
  border: 1.5px solid var(--rule);
  background: var(--surface);
  color: var(--ink);
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 120ms, border-color 120ms, background 120ms, color 120ms;
  min-width: 36px;
  min-height: 36px;
}
.cs-verdict-btn:hover:not(:disabled) { opacity: 0.85; }
.cs-verdict-btn:disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
.cs-verdict-approve {
  background: color-mix(in srgb, var(--olive) 16%, var(--surface));
  border-color: var(--olive);
  color: var(--olive);
}
.cs-verdict-approve:hover:not(:disabled) {
  background: color-mix(in srgb, var(--olive) 28%, var(--surface));
}
.cs-verdict-request_changes {
  background: color-mix(in srgb, #c93b3b 10%, var(--surface));
  border-color: #c93b3b;
  color: #c93b3b;
}
.cs-verdict-request_changes:hover:not(:disabled) {
  background: color-mix(in srgb, #c93b3b 20%, var(--surface));
}
.cs-verdict-comment {
  background: var(--surface-2);
  border-color: var(--rule);
  color: var(--ink-soft);
}
.cs-verdict-comment:hover:not(:disabled) {
  border-color: var(--muted);
}

/* ─── banner for annotate offline mode ────────────────────────────────────── */
.cs-banner-offline {
  max-width: var(--content-width, 70ch);
  margin: 16px auto 24px;
  padding: 0.5rem 0.875rem;
  background: color-mix(in srgb, var(--muted) 8%, var(--bg));
  border-radius: 8px;
  text-align: left;
  font-size: 0.9rem;
  color: var(--ink-soft);
}

/* diff block */
.diff-block {
  margin: var(--space-6, 1.5rem) 0;
  border: 1.5px solid var(--rule);
  border-radius: 12px;
  overflow: hidden;
  background: var(--code-bg);
  font-family: var(--mono);
  font-size: 13px;
  color: var(--code-fg);
}
.diff-block.fallback pre {
  margin: 0;
  padding: 12px 14px;
  white-space: pre;
  overflow-x: auto;
}
.diff-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  border-bottom: 1px solid color-mix(in oklab, var(--rule), transparent 40%);
  background: color-mix(in oklab, var(--code-bg), var(--code-fg) 5%);
  font-size: 12px;
  color: color-mix(in oklab, var(--code-fg), transparent 30%);
}
.diff-filename { font-weight: 500; }
.diff-stat { font-variant-numeric: tabular-nums; display: inline-flex; gap: 8px; }
.diff-stat .add { color: var(--diff-add); }
.diff-stat .rem { color: var(--diff-remove); }

.diff-grid {
  display: grid;
  grid-template-columns: 1fr 60px 1fr;
  align-items: start;
}
.diff-side {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  overflow-x: auto;
  min-width: 0;
}
.diff-line {
  display: grid;
  grid-template-columns: 3.25em 1fr;
  gap: 0;
  height: 22px;
  line-height: 22px;
  white-space: pre;
}
.diff-line .num {
  text-align: right;
  padding-right: 12px;
  color: color-mix(in oklab, var(--code-fg), transparent 60%);
  user-select: none;
  font-variant-numeric: tabular-nums;
}
.diff-line .content {
  padding-right: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.diff-line.add  { background: color-mix(in oklab, transparent, var(--diff-add) 14%); }
.diff-line.remove { background: color-mix(in oklab, transparent, var(--diff-remove) 14%); }
.diff-line.hunk-sep {
  background: color-mix(in oklab, var(--code-bg), var(--code-fg) 8%);
  color: color-mix(in oklab, var(--code-fg), transparent 50%);
  font-style: italic;
  font-size: 11px;
}

.diff-connector {
  position: relative;
  align-self: stretch;
  padding: 8px 0;
  background: color-mix(in oklab, var(--code-bg), var(--code-fg) 2%);
  border-left: 1px solid color-mix(in oklab, var(--rule), transparent 60%);
  border-right: 1px solid color-mix(in oklab, var(--rule), transparent 60%);
}
.diff-connector svg {
  display: block;
  width: 100%;
}
.diff-conn { stroke-width: 1; }
.diff-conn.add    { fill: var(--diff-add);    stroke: var(--diff-add);    fill-opacity: 0.22; }
.diff-conn.remove { fill: var(--diff-remove); stroke: var(--diff-remove); fill-opacity: 0.22; }
.diff-conn.change { fill: var(--diff-change); stroke: var(--diff-change); fill-opacity: 0.18; }

.diff-block figcaption {
  padding: 8px 14px;
  border-top: 1px solid color-mix(in oklab, var(--rule), transparent 40%);
  font-size: 12px;
  font-family: var(--sans);
  color: color-mix(in oklab, var(--code-fg), transparent 30%);
}

@media (max-width: 720px) {
  .diff-grid { grid-template-columns: 1fr; }
  .diff-connector { display: none; }
  .diff-side.before { border-bottom: 1px solid color-mix(in oklab, var(--rule), transparent 60%); }
}
`;
}

/** Backward-compat: returns themeTokensCss(theme) + frameworkRulesCss().
 *  Used by anyone wanting the full self-contained CSS in one string. */
export function frameworkCss(theme: ThemeTokens): string {
  return `${themeTokensCss(theme)}
${frameworkRulesCss()}`;
}

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
  position: sticky;
  top: 0;
  padding: 0.75rem 1.25rem;
  background: color-mix(in srgb, var(--accent) 20%, var(--bg));
  border-bottom: 1.5px solid var(--accent);
  text-align: center;
  font-weight: 600;
  z-index: 10;
}
`;
}

/** Backward-compat: returns themeTokensCss(theme) + frameworkRulesCss().
 *  Used by anyone wanting the full self-contained CSS in one string. */
export function frameworkCss(theme: ThemeTokens): string {
  return `${themeTokensCss(theme)}
${frameworkRulesCss()}`;
}

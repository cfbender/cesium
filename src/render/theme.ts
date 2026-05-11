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

export function defaultTheme(): ThemeTokens {
  return {
    colors: {
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
    fonts: {
      serif: 'ui-serif, Georgia, "Times New Roman", serif',
      sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, "SF Mono", Menlo, Monaco, monospace',
    },
  };
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

export function frameworkCss(theme: ThemeTokens): string {
  return `${themeToCssVars(theme)}

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
`;
}

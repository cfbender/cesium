---
name: cesium-preview
description: Render a cesium block or layout to a standalone HTML file in /tmp and open it in the browser, bypassing the opencode plugin host. Use when iterating on cesium's visual output (block renderers, theme CSS, SVG, layout, color tuning) inside the cesium repo, so the user doesn't have to restart opencode after every code change to see results.
---

# cesium-preview

Hot-reload visual iteration for cesium plugin development.

## Why this exists

The cesium plugin (`cesium_publish` / `cesium_ask`) is loaded into the opencode
process at session start. Source-code changes to `src/` do NOT take effect
until opencode is restarted. That kills the iteration loop when you're tuning
a block renderer, CSS rule, or SVG path.

This skill works around that by importing cesium source modules directly via
`bun`, generating a full standalone HTML file with framework CSS inlined, and
opening it in the browser. Edit source → re-run the script → refresh browser.
No restart.

## When to use

- Iterating on a block renderer (e.g. `src/render/blocks/renderers/*.ts`)
- Tuning framework CSS in `src/render/theme.ts`
- Visual review of new SVG / layout work
- Dogfooding a new block type before its validator is in the running plugin host

Not needed for: pure logic work without visual output, anything where unit
tests are a fast enough loop, anything where `cesium_publish` from a
freshly-restarted session would be fast enough.

## Quick start

The cesium repo has a canonical example at `scripts/dogfood-diff.ts`. Copy
it, swap the fixture blocks, and re-run.

Minimal preview script template:

```ts
// scripts/preview-<feature>.ts
import { renderBlocks } from "../src/render/blocks/render.ts";
import { themeFromPreset, frameworkCss } from "../src/render/theme.ts";
import { resolveHighlightTheme } from "../src/render/blocks/highlight.ts";
import type { Block } from "../src/render/blocks/types.ts";
import { writeFile } from "node:fs/promises";

const blocks: Block[] = [
  // ... your fixture blocks here ...
];

const theme = themeFromPreset("claret-dark");
const highlightTheme = resolveHighlightTheme("claret-dark");
const body = await renderBlocks(blocks, { highlightTheme });
const css = frameworkCss(theme);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>cesium preview</title>
  <style>${css}</style>
</head>
<body>
${body}
</body>
</html>`;

const out = "/tmp/cesium-preview-<feature>.html";
await writeFile(out, html, "utf8");
console.log("wrote", out, "—", html.length, "chars");
```

Run with:

```bash
bun run scripts/preview-<feature>.ts && open /tmp/cesium-preview-<feature>.html
```

After any source edit, re-run the same one-liner. The browser tab refreshes
to show the new output.

## Critical gotcha

**Do NOT use `wrapDocument` with `themeCssHref: null`.** That suppresses the
`<link>` to `/theme.css` and only inlines a tiny ~8-line fallback — the
preview will look broken (no grid, no colors). The right pattern is to
inline `frameworkCss(theme)` directly in a custom `<style>` tag, as the
template above does.

`wrapDocument` is designed for artifacts served by the cesium HTTP server.
Standalone preview wants the full CSS embedded.

## Workflow

1. Decide which block(s) you're iterating on.
2. Copy `scripts/dogfood-diff.ts` to `scripts/preview-<feature>.ts` and
   replace the fixture `blocks` array with content that exercises your
   visual change (mix of edge cases: empty, minimal, realistic, busy).
3. First run: `bun run scripts/preview-<feature>.ts && open /tmp/cesium-preview-<feature>.html`.
4. Loop: edit source → `bun run scripts/preview-<feature>.ts` → cmd-R in browser.
5. When done, leave the preview script in `scripts/` — it's a useful
   regression check for future visual work on the same block.

## Theme switching

To preview the same content across themes, parameterize the script:

```ts
const presetName = process.argv[2] ?? "claret-dark";
const theme = themeFromPreset(presetName);
const highlightTheme = resolveHighlightTheme(presetName);
```

Then run `bun run scripts/preview.ts warm` etc. across all 7 presets:
`claret`, `claret-dark`, `claret-light`, `warm`, `cool`, `mono`, `paper`.

## Tips

- The preview file is regenerated on each run — refresh the existing tab,
  don't reopen.
- Add multiple fixtures in one preview to compare layouts side-by-side
  (use `<hr>` or section breaks between them).
- For interactive (cesium_ask) iteration, you can't easily preview without
  the server — restart opencode for those changes, or run a foreground
  `cesium serve` and write artifacts directly into the state dir.
- `renderBlocks` is async and runs shiki at SSR time, so the preview
  output includes styled token spans for any `code` and `diff` blocks.

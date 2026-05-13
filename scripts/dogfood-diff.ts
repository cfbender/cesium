// Standalone dogfood: imports the new diff block code directly and writes a
// full artifact to /tmp so we can view it before restarting opencode.

import { renderBlocks } from "../src/render/blocks/render.ts";
import { themeFromPreset, frameworkCss } from "../src/render/theme.ts";
import { resolveHighlightTheme } from "../src/render/blocks/highlight.ts";
import type { Block } from "../src/render/blocks/types.ts";
import { writeFile } from "node:fs/promises";

const blocks: Block[] = [
  {
    type: "hero",
    eyebrow: "v0.5.2-dev",
    title: "Diff block — first dogfood",
    subtitle: "Split-view code diffs with bezier connectors. Both input arms exercised below.",
    meta: [
      { k: "Status", v: "Visual review" },
      { k: "Block type", v: "diff" },
    ],
  },
  {
    type: "tldr",
    markdown:
      "**New block type: `diff`.** Renders a side-by-side before/after code diff with curved SVG bezier connectors between the two columns. Per-line shiki highlighting, line tints, file headers, stats. Two arms: pre-baked unified `patch` strings, or `before`+`after` text pairs.",
  },
  {
    type: "section",
    title: "Mixed change (before/after arm)",
    children: [
      {
        type: "prose",
        markdown:
          "A function gets refactored from sync to async with extra null checking. Multi-line replacement — the connector should curve dramatically because the two regions have different sizes.",
      },
      {
        type: "diff",
        filename: "src/auth.ts",
        lang: "typescript",
        before:
          "function login(user, pass) {\n  const u = db.find(user);\n  return u.password === pass;\n}\n\nfunction logout() {\n  session.clear();\n}",
        after:
          "async function login(user, pass) {\n  const u = await db.find(user);\n  if (!u) return null;\n  if (!verify(u, pass)) {\n    return null;\n  }\n  return u;\n}\n\nasync function logout() {\n  await session.clear();\n  audit.log('logout');\n}",
      },
    ],
  },
  {
    type: "section",
    title: "Pure addition",
    children: [
      {
        type: "prose",
        markdown:
          "Three lines added to an existing function, no removals. The connector becomes a teardrop pointing into the left side.",
      },
      {
        type: "diff",
        filename: "src/cache.ts",
        lang: "typescript",
        before: "export function get(key) {\n  return store.get(key);\n}",
        after:
          "export function get(key) {\n  if (!key) throw new Error('key required');\n  metrics.increment('cache.get');\n  trace.span('cache.get', { key });\n  return store.get(key);\n}",
      },
    ],
  },
  {
    type: "section",
    title: "Pure deletion",
    children: [
      {
        type: "prose",
        markdown: "Three lines removed. Mirror of the above — teardrop pointing into the right.",
      },
      {
        type: "diff",
        filename: "src/legacy.ts",
        lang: "typescript",
        before:
          "export function compute(x) {\n  console.log('compute called');\n  console.log('input:', x);\n  console.log('starting');\n  return x * 2;\n}",
        after: "export function compute(x) {\n  return x * 2;\n}",
      },
    ],
  },
  {
    type: "section",
    title: "Unified-patch arm",
    children: [
      {
        type: "prose",
        markdown:
          "Same renderer, different input shape — agent supplies a literal unified diff string (e.g. from `git diff`).",
      },
      {
        type: "diff",
        filename: "src/router.ts",
        lang: "typescript",
        caption: "Reproduced from a git diff output — patch arm, no before/after text supplied.",
        patch:
          "@@ -12,7 +12,9 @@\n export function route(req) {\n   const handler = routes.get(req.path);\n-  if (!handler) return notFound();\n-  return handler(req);\n+  if (!handler) {\n+    return notFound(req);\n+  }\n+  return await handler(req);\n }\n",
      },
    ],
  },
  {
    type: "section",
    title: "Multi-region with context",
    children: [
      {
        type: "prose",
        markdown:
          "Two separate change regions with unchanged context lines between them — confirms multiple bezier paths render and the unchanged context flows correctly across both columns.",
      },
      {
        type: "diff",
        filename: "src/parser.ts",
        lang: "typescript",
        before:
          "export function parse(input) {\n  const tokens = tokenize(input);\n  const ast = buildAst(tokens);\n  return ast;\n}\n\nfunction tokenize(input) {\n  return input.split(' ');\n}\n\nfunction buildAst(tokens) {\n  return tokens.map(t => ({ kind: 'word', value: t }));\n}",
        after:
          "export function parse(input, opts = {}) {\n  const tokens = tokenize(input, opts);\n  validate(tokens);\n  const ast = buildAst(tokens);\n  return ast;\n}\n\nfunction tokenize(input, opts) {\n  const sep = opts.sep ?? ' ';\n  return input.split(sep);\n}\n\nfunction buildAst(tokens) {\n  return tokens.map((t, i) => ({ kind: 'word', value: t, index: i }));\n}",
      },
    ],
  },
  {
    type: "callout",
    variant: "note",
    title: "What to look for",
    markdown:
      "1. **Bezier curves are visible** in the 60px middle column — semi-transparent fills with stroke outline.\n2. **Line tints** — removes have a muted red wash, adds a muted green wash.\n3. **Per-line shiki highlighting** survives the diff — keywords/strings/types still colored.\n4. **Line numbers** — left side shows before-line-numbers, right side shows after-line-numbers, including renumbering after removals/additions.\n5. **Header strip** shows filename + `+N -M` stats; **caption** appears below where set.",
  },
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
  <title>Diff block — first dogfood · cesium</title>
  <style>${css}</style>
</head>
<body>
${body}
</body>
</html>`;

const out = "/tmp/cesium-diff-dogfood.html";
await writeFile(out, html, "utf8");
console.log("wrote", out, "—", html.length, "chars");
console.log("contains <svg:", html.includes("<svg"));
console.log("contains diff-conn:", html.includes("diff-conn"));
console.log("path classes seen:");
for (const m of html.matchAll(/diff-conn (add|remove|change)/g)) {
  console.log("  ", m[0]);
}

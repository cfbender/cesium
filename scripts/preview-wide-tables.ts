// Preview: wide tables in cards — regression / fix verification.
//
// Exercises the failure mode the user reported: tables inside a section's
// auto-card wrapper that burst out of the card when content is too wide.
// Cases: many columns, long unbroken cell content, narrow-content but still
// many columns.

import { renderBlocks } from "../src/render/blocks/render.ts";
import { themeFromPreset, frameworkCss } from "../src/render/theme.ts";
import { resolveHighlightTheme } from "../src/render/blocks/highlight.ts";
import type { Block } from "../src/render/blocks/types.ts";
import { writeFile } from "node:fs/promises";

const blocks: Block[] = [
  {
    type: "hero",
    title: "Wide-table card overflow",
    eyebrow: "preview",
    lede: "Three failure modes a card has to survive.",
  },

  {
    type: "section",
    title: "Long-cell content (single huge word / URL)",
    sectionNum: "01",
    children: [
      {
        type: "compare_table",
        headers: ["Field", "Value"],
        rows: [
          [
            "URL",
            "https://example.com/very/long/path/that/keeps/going/and/going/and/will/absolutely/burst/the/card/if/we/dont/wrap/it",
          ],
          [
            "Identifier",
            "this_is_a_very_long_underscore_separated_identifier_that_should_wrap_or_scroll_inside_the_card_not_outside",
          ],
          ["Short", "fits fine"],
        ],
      },
    ],
  },

  {
    type: "section",
    title: "Many columns, moderate content per cell",
    sectionNum: "02",
    children: [
      {
        type: "compare_table",
        headers: ["Feature", "Variant A", "Variant B", "Variant C", "Variant D", "Variant E", "Variant F"],
        rows: [
          ["Speed", "fast", "medium", "slow", "fast", "medium", "slow"],
          ["Memory", "low", "medium", "high", "low", "medium", "high"],
          ["Cost", "$1.00", "$2.50", "$4.00", "$1.00", "$2.50", "$4.00"],
        ],
      },
    ],
  },

  {
    type: "section",
    title: "Risk table with long mitigation text",
    sectionNum: "03",
    children: [
      {
        type: "risk_table",
        rows: [
          {
            risk: "Connection_pool_exhaustion_when_many_concurrent_users_hit_the_login_endpoint_simultaneously",
            likelihood: "med",
            impact: "high",
            mitigation:
              "Add pgbouncer in transaction-pooling mode in front of the primary, raise max_connections from 100 to 400, and add a leaky-bucket rate limiter at the gateway tier so the worst-case burst is bounded.",
          },
          {
            risk: "Stale cache",
            likelihood: "low",
            impact: "low",
            mitigation: "TTL + manual purge endpoint.",
          },
        ],
      },
    ],
  },

  {
    type: "section",
    title: "Baseline (should be unaffected)",
    sectionNum: "04",
    children: [
      {
        type: "compare_table",
        headers: ["Mode", "Tokens", "Type safety"],
        rows: [
          ["html", "high", "none"],
          ["blocks", "**~2× lower**", "full"],
        ],
      },
    ],
  },
];

const presetName = process.argv[2] ?? "claret-dark";
const theme = themeFromPreset(presetName);
const highlightTheme = resolveHighlightTheme(presetName);
const body = await renderBlocks(blocks, { highlightTheme });
const css = frameworkCss(theme);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>cesium preview · wide tables</title>
  <style>${css}</style>
</head>
<body>
<div class="page">
${body}
</div>
</body>
</html>`;

const out = "/tmp/cesium-preview-wide-tables.html";
await writeFile(out, html, "utf8");
console.log("wrote", out, "—", html.length, "chars");

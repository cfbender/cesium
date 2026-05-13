// Code block renderer — server-side syntax highlighting via shiki.
// src/render/blocks/renderers/code.ts

import type { CodeBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { anchorAttr } from "../render.ts";
import { escapeHtml, escapeAttr } from "../escape.ts";
import { highlightCode } from "../highlight.ts";

/**
 * Inject data-cesium-anchor attributes onto each <span class="line"> in highlighted HTML.
 * Counter is 1-indexed. The anchor value is safe by construction — no escaping needed.
 */
function injectLineAnchors(html: string, blockAnchor: string): string {
  let lineNum = 0;
  return html.replace(/<span class="line">/g, () => {
    lineNum++;
    return `<span class="line" data-cesium-anchor="${blockAnchor}.line-${lineNum}">`;
  });
}

export async function renderCode(block: CodeBlock, ctx: RenderCtx): Promise<string> {
  const parts: string[] = [];

  const captionText = block.filename ?? block.caption;
  if (captionText !== undefined && captionText !== "") {
    parts.push(`  <figcaption>${escapeHtml(captionText)}</figcaption>`);
  }

  const highlighted = await highlightCode(block.code, block.lang, ctx.highlightTheme);
  const withAnchors =
    ctx.anchor !== null ? injectLineAnchors(highlighted, ctx.anchor) : highlighted;
  parts.push(`  <pre><code class="lang-${escapeAttr(block.lang)}">${withAnchors}</code></pre>`);

  return `<figure class="code"${anchorAttr(ctx)}>\n${parts.join("\n")}\n</figure>`;
}

export const meta: BlockMeta = {
  type: "code",
  description: "Code block with syntax language label and optional filename/caption.",
  schema: {
    type: "object",
    properties: {
      type: { const: "code" },
      lang: { type: "string" },
      code: { type: "string" },
      filename: { type: "string" },
      caption: { type: "string" },
    },
    required: ["type", "lang", "code"],
  },
  example: {
    type: "code",
    lang: "typescript",
    filename: "src/index.ts",
    code: 'import { createPublishTool } from "./tools/publish.ts";\nexport { createPublishTool };',
  },
};

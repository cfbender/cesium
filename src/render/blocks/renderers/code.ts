// Code block renderer — server-side syntax highlighting via shiki.
// src/render/blocks/renderers/code.ts

import type { CodeBlock } from "../types.ts";
import type { BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { escapeHtml, escapeAttr } from "../escape.ts";
import { highlightCode } from "../highlight.ts";

export async function renderCode(block: CodeBlock, _ctx: RenderCtx): Promise<string> {
  const parts: string[] = [];

  const captionText = block.filename ?? block.caption;
  if (captionText !== undefined && captionText !== "") {
    parts.push(`  <figcaption>${escapeHtml(captionText)}</figcaption>`);
  }

  const highlighted = await highlightCode(block.code, block.lang);
  parts.push(
    `  <pre><code class="lang-${escapeAttr(block.lang)}">${highlighted}</code></pre>`,
  );

  return `<figure class="code">\n${parts.join("\n")}\n</figure>`;
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

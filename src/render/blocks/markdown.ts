// Owned markdown subset — no external dependencies.
// src/render/blocks/markdown.ts
//
// Block-level: paragraph, bullet list (- ), ordered list (1. ),
//   blockquote (> ), horizontal rule (---), hard break (two-space EOL).
// Inline: **bold**, *italic*, `code`, [text](href) — external hrefs → plain text.
// HTML safelist: <kbd>, <span class="pill">, <span class="tag">.
//   Everything else is HTML-escaped.

import { escapeHtml, escapeAttr } from "./escape.ts";

// ─── Safelist placeholder pass ───────────────────────────────────────────────

const SAFELIST_RE = /<(kbd)>(.*?)<\/kbd>|<span\s+class="(pill|tag)">(.*?)<\/span>/gi;

function extractSafelist(input: string): { text: string; map: Map<string, string> } {
  const map = new Map<string, string>();
  let counter = 0;
  const text = input.replace(SAFELIST_RE, (...args: unknown[]) => {
    // args: [fullMatch, kbdTag, kbdContent, spanClass, spanContent, offset, string]
    const full = args[0] as string;
    const kbdTag = args[1] as string | undefined;
    const kbdContent = args[2] as string | undefined;
    const spanClass = args[3] as string | undefined;
    const spanContent = args[4] as string | undefined;

    let html: string;
    if (kbdTag !== undefined && kbdContent !== undefined) {
      html = `<kbd>${escapeHtml(kbdContent)}</kbd>`;
    } else if (spanClass !== undefined && spanContent !== undefined) {
      html = `<span class="${escapeAttr(spanClass)}">${escapeHtml(spanContent)}</span>`;
    } else {
      // Shouldn't happen, but fall back to escaping the whole match
      html = escapeHtml(full);
    }

    const id = `\x00SAFE${counter++}\x00`;
    map.set(id, html);
    return id;
  });
  return { text, map };
}

function restoreSafelist(html: string, map: Map<string, string>): string {
  let result = html;
  for (const [id, replacement] of map) {
    result = result.split(id).join(replacement);
  }
  return result;
}

// ─── Inline rendering ────────────────────────────────────────────────────────

const RELATIVE_HREF_RE = /^([/#]|[^:/?#]*[/?#]|[^:/?#]+$)/;

function renderInline(text: string): string {
  // Step 1: extract inline code spans before any escaping
  const codeMap = new Map<string, string>();
  let codeCounter = 0;
  let working = text.replace(/`([^`]+)`/g, (_m, inner: string) => {
    const id = `\x00CODE${codeCounter++}\x00`;
    codeMap.set(id, `<code>${escapeHtml(inner)}</code>`);
    return id;
  });

  // Step 2: escape remaining HTML
  working = working.replace(/&/g, "&amp;");
  working = working.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Step 3: process other inline patterns
  // **bold**
  working = working.replace(/\*\*(.+?)\*\*/g, (_m, inner: string) => `<strong>${inner}</strong>`);
  // *italic* (not preceded by another *)
  working = working.replace(
    /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
    (_m, inner: string) => `<em>${inner}</em>`,
  );
  // [text](href) — only relative/anchor hrefs; external → plain text
  working = working.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, linkText: string, href: string) => {
    if (RELATIVE_HREF_RE.test(href)) {
      return `<a href="${escapeAttr(href)}">${linkText}</a>`;
    }
    return linkText;
  });

  // Step 4: restore code spans and hard break placeholders
  for (const [id, html] of codeMap) {
    working = working.split(id).join(html);
  }
  working = working.split(HARD_BREAK_PLACEHOLDER).join("<br>");

  return working;
}

// ─── Block-level rendering ───────────────────────────────────────────────────

type Line = string;

function isHr(line: Line): boolean {
  return /^-{3,}\s*$/.test(line) || /^\*{3,}\s*$/.test(line) || /^_{3,}\s*$/.test(line);
}

function isBullet(line: Line): boolean {
  return /^[ \t]*[-*+]\s+/.test(line);
}

function isOrdered(line: Line): boolean {
  return /^[ \t]*\d+\.\s+/.test(line);
}

function isBlockquote(line: Line): boolean {
  return /^[ \t]*>\s?/.test(line);
}

function isBlank(line: Line): boolean {
  return line.trim() === "";
}

function getBulletContent(line: Line): string {
  return line.replace(/^[ \t]*[-*+]\s+/, "");
}

function getOrderedContent(line: Line): string {
  return line.replace(/^[ \t]*\d+\.\s+/, "");
}

function getBlockquoteContent(line: Line): string {
  return line.replace(/^[ \t]*>\s?/, "");
}

/** Applies hard-break rule: line ending with two spaces → placeholder, restored after escaping */
const HARD_BREAK_PLACEHOLDER = "\x00BR\x00";

function applyHardBreak(line: string): string {
  if (line.endsWith("  ")) {
    return line.slice(0, -2) + HARD_BREAK_PLACEHOLDER;
  }
  return line;
}

export function renderMarkdown(md: string): string {
  const { text: safeText, map: safeMap } = extractSafelist(md);
  const lines = safeText.split("\n");
  const parts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (isBlank(line)) {
      i++;
      continue;
    }

    if (isHr(line)) {
      parts.push("<hr>");
      i++;
      continue;
    }

    // Bullet list
    if (isBullet(line)) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (isBullet(lines[i] ?? "") ||
          (!isBlank(lines[i] ?? "") && /^[ \t]{2,}/.test(lines[i] ?? "")))
      ) {
        const cur = lines[i] ?? "";
        if (isBullet(cur)) {
          items.push(renderInline(applyHardBreak(getBulletContent(cur))));
        }
        i++;
      }
      parts.push(`<ul>\n${items.map((it) => `  <li>${it}</li>`).join("\n")}\n</ul>`);
      continue;
    }

    // Ordered list
    if (isOrdered(line)) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (isOrdered(lines[i] ?? "") ||
          (!isBlank(lines[i] ?? "") && /^[ \t]{2,}/.test(lines[i] ?? "")))
      ) {
        const cur = lines[i] ?? "";
        if (isOrdered(cur)) {
          items.push(renderInline(applyHardBreak(getOrderedContent(cur))));
        }
        i++;
      }
      parts.push(`<ol>\n${items.map((it) => `  <li>${it}</li>`).join("\n")}\n</ol>`);
      continue;
    }

    // Blockquote
    if (isBlockquote(line)) {
      const bqLines: string[] = [];
      while (
        i < lines.length &&
        (isBlockquote(lines[i] ?? "") ||
          (!isBlank(lines[i] ?? "") && !/^[-*]/.test(lines[i] ?? "")))
      ) {
        const cur = lines[i] ?? "";
        if (isBlockquote(cur)) {
          bqLines.push(renderInline(applyHardBreak(getBlockquoteContent(cur))));
        } else {
          bqLines.push(renderInline(applyHardBreak(cur)));
        }
        i++;
      }
      parts.push(`<blockquote>${bqLines.join("<br>")}</blockquote>`);
      continue;
    }

    // Paragraph — collect until blank or block-level
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i] ?? "") &&
      !isHr(lines[i] ?? "") &&
      !isBullet(lines[i] ?? "") &&
      !isOrdered(lines[i] ?? "") &&
      !isBlockquote(lines[i] ?? "")
    ) {
      paraLines.push(applyHardBreak(lines[i] ?? ""));
      i++;
    }
    if (paraLines.length > 0) {
      const inner = paraLines.map((l) => renderInline(l)).join("\n");
      parts.push(`<p>${inner}</p>`);
    }
  }

  const result = parts.join("\n");
  return restoreSafelist(result, safeMap);
}

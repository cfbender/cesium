// Server-side syntax highlighting via shiki.
// src/render/blocks/highlight.ts
//
// Lazy-initializes a shared highlighter on first call.
// Returns styled <span> tokens only — no <pre> wrapper.
// The caller (code renderer) is responsible for the <pre><code> panel chrome.

import type { ThemedToken, BundledLanguage } from "shiki";
import { escapeHtml } from "./escape.ts";

// ─── Supported languages ─────────────────────────────────────────────────────

/**
 * The curated language list loaded into the highlighter.
 * ~25 languages covering 95 %+ of real use.
 */
export const SUPPORTED_LANGUAGES: readonly string[] = [
  "typescript",
  "ts",
  "tsx",
  "javascript",
  "js",
  "jsx",
  "json",
  "html",
  "css",
  "markdown",
  "md",
  "shellscript",
  "sh",
  "bash",
  "shell",
  "python",
  "py",
  "rust",
  "go",
  "ruby",
  "rb",
  "yaml",
  "yml",
  "sql",
  "toml",
  "dockerfile",
  "diff",
];

// ─── Highlighter singleton ────────────────────────────────────────────────────

/** Promise cache — concurrent first-calls share one init. */
let highlighterPromise: Promise<import("shiki").Highlighter> | null = null;

async function getHighlighter(): Promise<import("shiki").Highlighter> {
  if (highlighterPromise === null) {
    const { createHighlighter } = await import("shiki");
    highlighterPromise = createHighlighter({
      themes: ["vitesse-dark"],
      langs: SUPPORTED_LANGUAGES as string[],
    });
  }
  return highlighterPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Highlight `code` in language `lang`.
 * Returns the inner HTML for a `<code>` element: one `<span class="line">` per
 * source line, each containing `<span style="color:...">` token spans.
 *
 * If `lang` is not in SUPPORTED_LANGUAGES, falls back to plain-escaped output
 * wrapped the same way (one `<span class="line">` per line, no color spans).
 *
 * shiki internally escapes `<`, `>`, `&` in token content, so XSS is covered.
 * The plain-text fallback goes through `escapeHtml` for the same guarantee.
 */
export async function highlightCode(code: string, lang: string): Promise<string> {
  const supported = SUPPORTED_LANGUAGES.includes(lang);

  if (!supported) {
    return plainFallback(code);
  }

  const hi = await getHighlighter();
  const result = hi.codeToTokens(code, { theme: "vitesse-dark", lang: lang as BundledLanguage });

  return tokensToHtml(result.tokens);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Render shiki token lines into `<span class="line">` HTML.
 * Token `content` is already HTML-escaped by shiki.
 */
function tokensToHtml(lines: ThemedToken[][]): string {
  return lines
    .map((line) => {
      const inner = line
        .map((token) => {
          if (token.color !== undefined && token.color !== "") {
            return `<span style="color:${token.color}">${token.content}</span>`;
          }
          // No color info — emit bare content (shiki has already escaped it)
          return token.content;
        })
        .join("");
      return `<span class="line">${inner}</span>`;
    })
    .join("\n");
}

/**
 * Plain-text fallback: escape HTML and wrap each line in a `<span class="line">`.
 * Used when the requested language is not in the supported set.
 */
function plainFallback(code: string): string {
  const lines = code.split("\n");
  return lines.map((line) => `<span class="line">${escapeHtml(line)}</span>`).join("\n");
}

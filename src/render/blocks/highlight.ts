// Server-side syntax highlighting via shiki.
// src/render/blocks/highlight.ts
//
// Lazy-initializes a shared highlighter on first call.
// Returns styled <span> tokens only — no <pre> wrapper.
// The caller (code renderer) is responsible for the <pre><code> panel chrome.

import type { ThemedToken, BundledLanguage } from "shiki";
import { escapeHtml } from "./escape.ts";
import { claretDark } from "./themes/claret-dark.ts";
import { claretLight } from "./themes/claret-light.ts";
import { THEME_PRESETS, isThemePresetName } from "../../render/theme.ts";

// ─── Highlight theme type ─────────────────────────────────────────────────────

export type HighlightTheme =
  | "claret-dark"
  | "claret-light"
  | "vitesse-dark"
  | "vitesse-light";

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

// ─── Theme resolution ─────────────────────────────────────────────────────────

/**
 * Map a cesium theme preset name to the appropriate shiki highlight theme.
 *
 * - "claret" / "claret-dark" → "claret-dark" (custom)
 * - "claret-light"           → "claret-light" (custom)
 * - other named preset       → vitesse-dark if codeBg is dark, else vitesse-light
 * - unknown / undefined      → "claret-dark" (matches framework default in themeFromPreset)
 */
export function resolveHighlightTheme(cesiumThemeName: string | undefined): HighlightTheme {
  if (cesiumThemeName === "claret" || cesiumThemeName === "claret-dark") {
    return "claret-dark";
  }
  if (cesiumThemeName === "claret-light") {
    return "claret-light";
  }
  if (cesiumThemeName !== undefined && isThemePresetName(cesiumThemeName)) {
    const palette = THEME_PRESETS[cesiumThemeName];
    // Use the code panel background color to choose the shiki theme.
    // All current non-claret presets have a dark codeBg, but check anyway.
    return isHexDark(palette.codeBg) ? "vitesse-dark" : "vitesse-light";
  }
  // undefined / unknown — match the framework theme default (claret-dark).
  return "claret-dark";
}

/**
 * Returns true if the hex color's perceived luminance is dark (< 0.5).
 * Accepts 3- or 6-digit hex with or without leading '#'.
 */
function isHexDark(hex: string): boolean {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean
        .split("")
        .map((c) => c + c)
        .join("")
    : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Simple average luminance threshold
  const avg = (r + g + b) / 3;
  return avg < 128;
}

// ─── Highlighter singleton ────────────────────────────────────────────────────

/** Promise cache — concurrent first-calls share one init. */
let highlighterPromise: Promise<import("shiki").Highlighter> | null = null;

async function getHighlighter(): Promise<import("shiki").Highlighter> {
  if (highlighterPromise === null) {
    const { createHighlighter } = await import("shiki");
    highlighterPromise = createHighlighter({
      themes: [
        // Custom claret themes passed as ThemeRegistration objects
        claretDark,
        claretLight,
        // Vitesse themes loaded by name from the bundled set
        "vitesse-dark",
        "vitesse-light",
      ],
      langs: SUPPORTED_LANGUAGES as string[],
    });
  }
  return highlighterPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Highlight `code` in language `lang` with the given `theme`.
 * Returns the inner HTML for a `<code>` element: one `<span class="line">` per
 * source line, each containing `<span style="color:...">` token spans.
 *
 * If `lang` is not in SUPPORTED_LANGUAGES, falls back to plain-escaped output
 * wrapped the same way (one `<span class="line">` per line, no color spans).
 *
 * shiki internally escapes `<`, `>`, `&` in token content, so XSS is covered.
 * The plain-text fallback goes through `escapeHtml` for the same guarantee.
 */
export async function highlightCode(
  code: string,
  lang: string,
  theme: HighlightTheme = "claret-dark",
): Promise<string> {
  const supported = SUPPORTED_LANGUAGES.includes(lang);

  if (!supported) {
    return plainFallback(code);
  }

  const hi = await getHighlighter();
  const result = hi.codeToTokens(code, { theme, lang: lang as BundledLanguage });

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

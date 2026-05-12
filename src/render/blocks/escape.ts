// Pure HTML escape helpers — no dependencies.
// src/render/blocks/escape.ts

/** Escapes a string for safe insertion as HTML text content. */
export function escapeHtml(s: string): string {
  if (typeof s !== "string") {
    throw new Error(`escapeHtml expected string, got ${typeof s}: ${String(s)}`);
  }
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapes a string for safe insertion as an HTML attribute value (double-quoted). */
export function escapeAttr(s: string): string {
  if (typeof s !== "string") {
    throw new Error(`escapeAttr expected string, got ${typeof s}: ${String(s)}`);
  }
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

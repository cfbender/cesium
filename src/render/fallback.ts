// Minimal inline fallback CSS — ~8 lines, ≤500 bytes minified.
// Goal: standalone .html files opened via file:// look "plain but readable,"
// not broken. Full styling comes from the served /theme.css.

/** Returns a compact CSS block covering typography, color tokens, and basic
 *  component borders. Used as the inline <style> fallback in every artifact.
 *  Budget: ≤500 bytes minified. */
export function fallbackCss(): string {
  return (
    ":root{font-family:system-ui,sans-serif;line-height:1.6;}" +
    "body{max-width:900px;margin:0 auto;padding:24px;}" +
    "@media(prefers-color-scheme:dark){body{background:#180810;color:#ddd;}}" +
    "pre,code{font-family:ui-monospace,monospace;font-size:.875em;}" +
    ".card,.tldr{border:1.5px solid #ccc;border-radius:8px;padding:14px 18px;}" +
    ".callout{border:1.5px solid #ccc;border-radius:6px;padding:12px 16px;}" +
    "table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ccc;padding:8px;}"
  );
}

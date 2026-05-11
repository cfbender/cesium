// Cesium favicon — periodic-table tile, element 55 ("Cs"), claret-dark palette.
//
// The SVG is theme-independent (always claret-dark wine + rose) so it stays
// recognizable as the cesium emblem regardless of the user's chosen theme.
//
// Two consumers:
//   1. `writeFaviconSvg` writes this string to <stateDir>/favicon.svg, which
//      is then referenced by <link rel="icon"> in artifact + index pages and
//      auto-served by the cesium HTTP server.
//   2. `faviconEmblemSvg` returns inline SVG markup suitable for placing next
//      to the "cesium" eyebrow on index pages (no <?xml?> declaration, no
//      role/aria — those are decorative chrome).

/** The full standalone favicon SVG written to <stateDir>/favicon.svg. */
export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Cesium — element 55">
  <!-- Periodic table tile, claret-dark palette -->
  <rect x="2" y="2" width="60" height="60" rx="10" ry="10" fill="#180810"/>
  <rect x="2.75" y="2.75" width="58.5" height="58.5" rx="9.25" ry="9.25"
        fill="none" stroke="#C75B7A" stroke-width="1.5"/>

  <!-- Atomic number, top-left -->
  <text x="8" y="18" fill="#C75B7A"
        font-family="ui-monospace, 'SF Mono', Menlo, Monaco, monospace"
        font-size="13" font-weight="700" letter-spacing="0.5">55</text>

  <!-- Element symbol, centered -->
  <text x="32" y="48" fill="#DDD3C7" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="36" font-weight="700" letter-spacing="-1">Cs</text>
</svg>
`;

/** Inline SVG emblem for placing next to the "cesium" eyebrow text.
 *  Decorative — uses aria-hidden so screen readers skip it (the text label
 *  next to it already says "cesium").
 *
 *  @param size — pixel size for both width and height. Defaults to 18.
 */
export function faviconEmblemSvg(size = 18): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" focusable="false" style="display:inline-block;vertical-align:-3px;flex-shrink:0;">
  <rect x="2" y="2" width="60" height="60" rx="10" ry="10" fill="#180810"/>
  <rect x="2.75" y="2.75" width="58.5" height="58.5" rx="9.25" ry="9.25" fill="none" stroke="#C75B7A" stroke-width="1.5"/>
  <text x="8" y="18" fill="#C75B7A" font-family="ui-monospace, 'SF Mono', Menlo, Monaco, monospace" font-size="13" font-weight="700" letter-spacing="0.5">55</text>
  <text x="32" y="48" fill="#DDD3C7" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="36" font-weight="700" letter-spacing="-1">Cs</text>
</svg>`;
}

/** Returns the <link rel="icon"> tag for an HTML head, given a relative href.
 *
 *  - Artifact pages (3 levels deep): href = "../../../favicon.svg"
 *  - Project index (2 levels deep):  href = "../../favicon.svg"
 *  - Global index (root):            href = "favicon.svg"
 */
export function faviconLinkTag(href: string): string {
  return `<link rel="icon" type="image/svg+xml" href="${href}">`;
}

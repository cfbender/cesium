# Cesium classes — compact reference

The `html` argument to `cesium_publish` / `cesium_ask` is body-only (no
`<!doctype>`, `<html>`, `<head>`, `<body>` — the plugin wraps your body with the
design system). Inline `style="..."` and inline `<svg>` are encouraged for
bespoke diagrams. NEVER reference external resources (no `<script src>`, remote
fonts, or CDN images) — the scrub pass strips them.

## Headings & labels

- `.eyebrow` — uppercase mono micro-label above headings.
  `<div class="eyebrow">section · context</div>`
- `.h-display` — page-title heading (large serif).
  `<h1 class="h-display">Title</h1>`
- `.h-section` — major section heading.
  `<h2 class="h-section">Section title</h2>`
- `.section-num` — numbered chip paired with `.h-section`.
  `<h2 class="h-section"><span class="section-num">01</span>Title</h2>`

## Surfaces

- `.card` — bordered surface block (1.5px border, 12px radius).
  `<div class="card">...</div>`
- `.tldr` — clay-bordered summary box. **Use ONE per doc, near top.**
  `<div class="tldr"><strong>Headline:</strong> one-sentence summary.</div>`

## Callouts

- `.callout` — info box. Modifiers: `.note` (olive), `.warn` (accent),
  `.risk` (amber).
  `<div class="callout note"><strong>Note:</strong> message.</div>`

## Code

- `.code` — block-level monospace panel. Use `<pre class="code">` to preserve
  whitespace. Inline highlight spans inside:
  - `.kw` keyword (accent) · `.str` string (olive) · `.cm` comment (muted
    italic) · `.fn` function name (gold).

  ```
  <pre class="code"><span class="kw">async function</span> <span class="fn">foo</span>() {
    <span class="cm">// note</span>
    <span class="kw">return</span> <span class="str">"value"</span>;
  }</pre>
  ```

## Timeline

- `.timeline` — milestone list with dots and connectors.
  ```
  <ul class="timeline">
    <li><strong>Phase 1.</strong> Description.</li>
    <li><strong>Phase 2.</strong> Description.</li>
  </ul>
  ```

## Diagram

- `.diagram` — wraps inline SVG with a caption.
  ```
  <figure class="diagram">
    <svg viewBox="0 0 400 200">...</svg>
    <figcaption>Caption text</figcaption>
  </figure>
  ```

## Tables

- `.compare-table` — bordered comparison grid.
  ```
  <table class="compare-table">
    <thead><tr><th>Option</th><th>Pros</th><th>Cons</th></tr></thead>
    <tbody><tr><td>A</td><td>Fast</td><td>Costly</td></tr></tbody>
  </table>
  ```
- `.risk-table` — risk grid (likelihood / impact / mitigation columns; first
  column emphasized). Same structure as compare-table.

## Inline chips

- `.kbd` — keyboard key. `<span class="kbd">⌘K</span>`
- `.pill` — small status/version chip. `<span class="pill">v2.4.1</span>`
  Modifier: `.pill.accent` for emphasis (filled accent color).
- `.tag` — topic/label tag. `<span class="tag">auth</span>`

## Ranked list

- `.ranked-list` + `.ranked-item` — numbered cards for ordered
  recommendations, findings, or rankings. Each item has a soft serif numeral
  on the left and a title + meta + body on the right. Use `.rank-aside` for a
  quieter "bonus" or "note" addendum after the main paragraphs.

  ```
  <ol class="ranked-list">
    <li class="ranked-item">
      <div class="rank-num">01</div>
      <div class="rank-body">
        <h3 class="rank-title">Recommendation title</h3>
        <div class="rank-meta">
          <span class="pill accent">High impact</span>
          <span class="tag">~6–8k tokens</span>
        </div>
        <p>Primary description paragraph.</p>
        <p class="rank-aside">
          <span class="rank-aside-label">Bonus</span>
          Secondary follow-up note.
        </p>
      </div>
    </li>
  </ol>
  ```

## Footer

- `.byline` — automatically rendered as the document footer. Don't add manually.

## Standard section pattern

```
<div class="eyebrow">02 · phase name</div>
<h2 class="h-section"><span class="section-num">02</span>Section title</h2>
<p>Body content...</p>
```

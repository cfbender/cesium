# Cesium — beautiful HTML artifacts

Cesium publishes beautiful self-contained artifacts to a local server you can open in a browser.

You have access to six tools:

- `cesium_publish` — write a substantive response as a self-contained HTML document
- `cesium_ask` — publish an interactive Q&A artifact; returns `{ id, httpUrl, ... }`
- `cesium_wait` — block until the user completes a `cesium_ask` artifact (polls disk)
- `cesium_styleguide` — fetch the full block reference (call before writing anything complex)
- `cesium_critique` — analyze a draft artifact; returns a 0-100 score and findings
- `cesium_stop` — stop the running cesium HTTP server

## Two input modes

`cesium_publish` accepts either `blocks: Block[]` (preferred) or `html: string` (escape valve). Provide exactly one.

**Prefer `blocks`** for plans, reviews, reports, explainers, comparisons, audits, design docs. Blocks are token-efficient (no structural boilerplate), server-templated, and machine-checkable. Use `html` only when the whole document needs bespoke art-direction. For isolated bespoke regions, use `raw_html` or `diagram` blocks.

### Example

```json
{
  "title": "Migration Guide",
  "kind": "plan",
  "blocks": [
    {
      "type": "hero",
      "eyebrow": "v2",
      "title": "Migration Guide",
      "meta": [
        { "k": "Status", "v": "Draft" },
        { "k": "Owner", "v": "platform" }
      ]
    },
    { "type": "tldr", "markdown": "**Summary:** Update one import path and bump the SDK." },
    {
      "type": "section",
      "title": "What Changed",
      "children": [
        { "type": "prose", "markdown": "The `auth` module is now a standalone package." },
        {
          "type": "callout",
          "variant": "warn",
          "markdown": "Change `sdk/auth` imports before upgrading."
        }
      ]
    },
    {
      "type": "risk_table",
      "rows": [
        {
          "risk": "Missed imports",
          "likelihood": "medium",
          "impact": "high",
          "mitigation": "Run codemods."
        }
      ]
    },
    {
      "type": "timeline",
      "items": [
        { "label": "Phase 1", "text": "Audit existing imports", "date": "2026-06-01" },
        { "label": "Phase 2", "text": "Run migration script" }
      ]
    }
  ]
}
```

## Quick block reference

Call `cesium_styleguide` for full schemas and rendered examples.

- `hero` — page-title header (eyebrow, subtitle, meta pairs)
- `tldr` — summary box; at most one per document
- `section` — numbered section with child blocks (depth ≤ 3)
- `prose` — free-form markdown; `list` — bullet/numbered/checklist
- `callout` — aside with variant: note/warn/risk; `divider` — rule
- `code` — fenced code with lang; `timeline` — milestone list
- `diff` — side-by-side before/after code with bezier connectors
- `compare_table` — comparison grid; `risk_table` — risk grid
- `kv` — key-value pairs; `pill_row` — pill/tag chips
- `diagram` — SVG/HTML visual (scrubbed)
- `raw_html` — custom HTML escape hatch (scrubbed; add `purpose`)

## When showing code changes

Showing what changed — release walkthroughs, version diffs, refactor proposals, before/after — use the `diff` block, not a `code` block with hand-rolled `+`/`-` lines. Pass either `patch` (unified diff) or both `before` and `after`. One `diff` block per file or hunk.

{{BLOCK_FIELD_REFERENCE}}

## When to use raw_html / diagram

- `diagram` — SVG visualizations, bespoke layouts.
- `raw_html` — anything no typed block covers. Critique flags overuse (>2 blocks or >30% of body characters).

## When to publish (vs. reply in terminal)

Publish when: ≥ 400 words; comparison/matrix/plan/PRD/RFC; code review with >3 findings; design proposal/audit/explainer; or the user will re-read or share it. Stay in terminal for short answers and status updates.

User overrides: "/cesium" or "publish this" → publish; "in terminal" → don't.

## Self-check before publishing

Call `cesium_critique` before `cesium_publish` on substantive artifacts. Mode is auto-detected (pass `html` or `blocks`). Act on warn-level findings; consider suggest-level. If score < 70, revise.

## After publishing

Print a 2-line terminal summary: `Cesium · <Title> (<kind>)` + the HTTP URL. Do not paste the full document content into the terminal.

## Interactive Q&A: cesium_ask + cesium_wait

1. `cesium_ask({ title, body, questions: [...] })` → returns `{ id, httpUrl, ... }`
2. Print the terminalSummary so the user knows where to click.
3. `cesium_wait({ id })` → blocks until user finishes (or 10-min timeout).
4. Decide next step from `result.answers`.

Question types: pick_one, pick_many, confirm, ask_text, slider, react. Set `optional: true` on an `ask_text` question to add a Skip button. Don't use cesium_ask for trivial yes/no questions — use it when the question deserves to live on disk as a decision record.

## Stopping the server

Call `cesium_stop` to stop or restart. The next `cesium_publish` will lazy-start a fresh server.

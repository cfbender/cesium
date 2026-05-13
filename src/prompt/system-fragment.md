# Cesium — beautiful HTML artifacts

Cesium publishes beautiful self-contained artifacts to a local server you can open in a browser.

You have access to seven tools:

- `cesium_publish` — write a substantive response as a self-contained HTML document
- `cesium_ask` — publish an interactive Q&A artifact; returns `{ id, httpUrl, ... }`
- `cesium_annotate` — publish a review artifact so the user can comment on the content and give a verdict
- `cesium_wait` — block until the user completes a `cesium_ask` or `cesium_annotate` artifact
- `cesium_styleguide` — fetch the full block reference (call before writing anything complex)
- `cesium_critique` — analyze a draft artifact; returns a 0-100 score and findings
- `cesium_stop` — stop the running cesium HTTP server

## Describing content with blocks

`cesium_publish` takes a `blocks: Block[]` array — a closed set of typed building blocks (hero, tldr, section, prose, list, callout, code, diff, timeline, compare_table, risk_table, kv, pill_row, divider, diagram, raw_html). Blocks are token-efficient, server-templated, and machine-checkable. Call `cesium_styleguide` for the full block catalog with schemas and rendered examples.

For content that doesn't fit any typed block, use `raw_html` (an escape hatch for free-form HTML) or `diagram` (for inline SVG/HTML visualizations).

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

## Choosing between cesium_publish, cesium_ask, and cesium_annotate

Three tools, three different shapes of conversation:

- **`cesium_publish`** — one-way broadcast. Use when delivering a finished artifact the user is likely to re-read or share, with no structured response needed.
- **`cesium_ask`** — structured Q&A. Use when you need bounded input: a pick between N options, a numeric slider, a confirm, an approve/reject reaction on a small proposal.
- **`cesium_annotate`** — review of substantive content. Use whenever you are asking the user to review, give feedback on, or approve generated content too rich for a yes/no — diffs, plans, PRDs, code proposals, RFCs, audits, design docs. The user can leave per-line and per-block comments and a final verdict (Approve / Request changes / Comment).

Routing rules:

- "Here's a diff — does it look right?" → `cesium_annotate`.
- "Here's a plan — any concerns?" → `cesium_annotate`.
- "Approve this short thing yes/no?" → `cesium_ask` with a `react` question.
- "Pick one of these three options" → `cesium_ask` with `pick_one`.
- Just delivering a finished artifact, no feedback needed → `cesium_publish`.

Default bias for review-flavored work: prefer `cesium_annotate` over chat back-and-forth. Inline comments on the actual content are dramatically higher-fidelity than asking the user to paste line references into a chat reply.

## Self-check before publishing

Call `cesium_critique` before `cesium_publish` on substantive artifacts. Act on warn-level findings; consider suggest-level. If score < 70, revise.

## After publishing

Print a 2-line terminal summary: `Cesium · <Title> (<kind>)` + the HTTP URL. Both `cesium_ask` and `cesium_annotate` return a `terminalSummary` field — print it the same way. Do not paste the full document content into the terminal.

## Interactive Q&A: cesium_ask

1. `cesium_ask({ title, body, questions: [...] })` → returns `{ id, httpUrl, ... }`
2. Print the terminalSummary so the user knows where to click.
3. `cesium_wait({ id })` → blocks until user finishes (or 10-min timeout).
4. Decide next step from `result.answers`.

Question types: pick_one, pick_many, confirm, ask_text, slider, react. Set `optional: true` on an `ask_text` question to add a Skip button. Don't use cesium_ask for trivial yes/no questions — use it when the question deserves to live on disk as a decision record.

## Reviewing content with cesium_annotate + cesium_wait

For PR-style reviews of substantive content (diffs, plans, PRDs, code, designs):

1. `cesium_annotate({ title, blocks: [...] })` → returns `{ id, httpUrl, terminalSummary, ... }`. The blocks render with hover affordances on every annotatable unit (per-line on `diff`/`code`, per-block elsewhere).
2. Print the terminalSummary so the user knows where to click.
3. `cesium_wait({ id })` → blocks until the user submits a verdict (10-min default timeout).
4. Read `result.kind`, `result.comments`, and `result.verdict`. Ignore `result.answers` and `result.remaining` — those are populated only for `cesium_ask` sessions.

Result shape for a completed annotate session:

```json
{
  "status": "complete",
  "kind": "annotate",
  "comments": [
    {
      "id": "...",
      "anchor": "block-2.line-5",
      "selectedText": "return x + 1",
      "comment": "Should this be x + 1 or x - 1?",
      "createdAt": "..."
    }
  ],
  "verdict": { "value": "request_changes", "decidedAt": "..." }
}
```

Verdict values: `approve`, `request_changes`, `comment`. `verdict` may be `null` if the session timed out before the user decided. Each comment has a unique `id` and an `anchor` — either `block-N` (a whole block) or `block-N.line-M` (a single line inside a `diff` or `code` block).

**Round-trip:** when the verdict is `request_changes`, revise the content and publish a new `cesium_annotate` with `supersedes` pointing at the prior id. The user can review the revision the same way.

**Configuration:**

- `verdictMode`: `"approve"` | `"approve-or-reject"` | `"full"` (default `"full"` — exposes all three verdict buttons).
- `perLineFor`: array of block types that get per-line anchors. Default `["diff", "code"]`.
- `requireVerdict`: if true (default), the session stays open until the user picks a verdict; otherwise the user can submit just comments.
- `expiresAt`: ISO timestamp after which the session auto-expires. Default 24 hours from publish.

Use `cesium_annotate` whenever a review with targeted comments would be higher fidelity than a chat back-and-forth.

## Stopping the server

Call `cesium_stop` to stop or restart. The next `cesium_publish` will lazy-start a fresh server.

// Regenerates the four reference HTML artifacts in `examples/` from inline body
// templates. Run via `bun run examples:bake`.
//
// Each example dogfoods the cesium render pipeline: bodies are passed through
// `wrapDocument`, which inlines the framework CSS, embeds metadata, and renders
// the byline footer. Output files are committed so they're visible on GitHub.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultTheme } from "../src/render/theme.ts";
import { wrapDocument, type ArtifactMeta } from "../src/render/wrap.ts";
import { writeThemeCss } from "../src/storage/theme-write.ts";

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(here, "..", "examples");
mkdirSync(examplesDir, { recursive: true });

const FROZEN_DATE = "2026-05-11T14:22:09.000Z";

interface ExampleSeed {
  id: string;
  title: string;
  kind: string;
  summary: string;
  tags: string[];
}

function makeMeta(seed: ExampleSeed): ArtifactMeta {
  return {
    id: seed.id,
    title: seed.title,
    kind: seed.kind,
    summary: seed.summary,
    tags: seed.tags,
    createdAt: FROZEN_DATE,
    model: "claude-opus-4.7",
    sessionId: "ses_example",
    projectSlug: "github-com-cfbender-acme",
    projectName: "cfbender/acme",
    cwd: "/Users/cfb/code/github/acme",
    worktree: null,
    gitBranch: "main",
    gitCommit: "abc123def456abc123def456abc123def456abc1",
    supersedes: null,
    supersededBy: null,
    contentSha256: "0".repeat(64),
  };
}

interface Example {
  filename: string;
  meta: ArtifactMeta;
  body: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAN — implementation plan for an audit log
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_BODY = `<header style="margin-bottom: 48px; max-width: 820px;">
  <div class="eyebrow">Implementation plan · acme/api</div>
  <h1 class="h-display">Audit log for user actions</h1>
  <div class="tldr">
    <strong>TL;DR</strong> — Append-only audit log behind <code>audit_log_v1</code>,
    rolled out in four reviewable slices over two weeks. Writes go through a thin
    service layer with optimistic-batch flushes; reads are powered by a single
    composite index. Nothing is user-visible until slice 4.
  </div>
</header>

<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 56px;">
  <div class="card">
    <div class="eyebrow">Effort</div>
    <div style="font-size: 18px; color: var(--ink); font-weight: 600;">~2 weeks</div>
  </div>
  <div class="card">
    <div class="eyebrow">Surfaces touched</div>
    <div style="font-size: 18px; color: var(--ink); font-weight: 600;">3 packages</div>
  </div>
  <div class="card">
    <div class="eyebrow">New tables</div>
    <div style="font-size: 18px; color: var(--ink); font-weight: 600;">2</div>
  </div>
  <div class="card">
    <div class="eyebrow">Feature flag</div>
    <div style="font-size: 18px; color: var(--ink); font-weight: 600;">audit_log_v1</div>
  </div>
</div>

<section style="margin-bottom: 56px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
    <span class="section-num">01</span>
    <h2 class="h-section">Milestones</h2>
  </div>
  <p style="color: var(--muted); margin-bottom: 24px;">
    Four slices, each independently reviewable and behind <code>audit_log_v1</code>.
  </p>
  <ol class="timeline">
    <li>
      <div class="when">Wk 1 · Mon–Tue</div>
      <div class="body">
        <h3>Schema &amp; service contract</h3>
        <p>New <code>audit_events</code> + <code>audit_targets</code> tables, migration,
        and the gRPC service stubs. Contract reviewed before any caller lands.</p>
      </div>
    </li>
    <li>
      <div class="when">Wk 1 · Wed–Fri</div>
      <div class="body">
        <h3>Write path with batched flush</h3>
        <p>Producers enqueue events in-memory; a 200 ms-or-100-row flush worker writes
        in one transaction. Backpressure: drop with a metric, never block the caller.</p>
      </div>
    </li>
    <li>
      <div class="when">Wk 2 · Mon–Wed</div>
      <div class="body">
        <h3>Read API &amp; pagination</h3>
        <p>Cursor-paginated query by <code>(actor_id, created_at)</code>; filter helpers
        for action type and target. Ships behind a separate flag for internal-only review.</p>
      </div>
    </li>
    <li>
      <div class="when">Wk 2 · Thu–Fri</div>
      <div class="body">
        <h3>Dashboards, ramp, docs</h3>
        <p>Grafana panels for write rate &amp; flush latency. Ramp to 10 % → 100 %
        over three days. Internal docs page at <code>/docs/audit</code>.</p>
      </div>
    </li>
  </ol>
</section>

<section style="margin-bottom: 56px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
    <span class="section-num">02</span>
    <h2 class="h-section">Data flow</h2>
  </div>
  <p style="color: var(--muted); margin-bottom: 24px;">
    Producer never blocks on the database. The flush worker batches and reconciles.
  </p>
  <figure class="diagram">
    <svg viewBox="0 0 760 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="audit log data flow">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#87867F"/>
        </marker>
      </defs>
      <g font-family="ui-monospace, monospace" font-size="12" fill="#141413">
        <rect x="20" y="80" width="160" height="60" rx="10" fill="#FFFFFF" stroke="#D1CFC5" stroke-width="1.5"/>
        <text x="100" y="106" text-anchor="middle" font-weight="600">Producer</text>
        <text x="100" y="124" text-anchor="middle" fill="#87867F" font-size="10.5">apps/api handlers</text>

        <rect x="290" y="20" width="180" height="60" rx="10" fill="#FFFFFF" stroke="#D1CFC5" stroke-width="1.5"/>
        <text x="380" y="46" text-anchor="middle" font-weight="600">In-memory queue</text>
        <text x="380" y="64" text-anchor="middle" fill="#87867F" font-size="10.5">cap 10k · drop on full</text>

        <rect x="290" y="140" width="180" height="60" rx="10" fill="#FFFFFF" stroke="#D1CFC5" stroke-width="1.5"/>
        <text x="380" y="166" text-anchor="middle" font-weight="600">Flush worker</text>
        <text x="380" y="184" text-anchor="middle" fill="#87867F" font-size="10.5">200 ms or 100 rows</text>

        <rect x="580" y="80" width="160" height="60" rx="10" fill="#141413"/>
        <text x="660" y="106" text-anchor="middle" font-weight="600" fill="#FAF9F5">audit_events</text>
        <text x="660" y="124" text-anchor="middle" fill="#C9B98A" font-size="10.5">postgres · primary</text>
      </g>
      <g stroke="#87867F" stroke-width="1.5" fill="none">
        <path d="M180 100 L290 50" marker-end="url(#arr)"/>
        <path d="M380 80 L380 140" marker-end="url(#arr)"/>
        <path d="M470 170 L580 120" marker-end="url(#arr)"/>
      </g>
    </svg>
    <figcaption>Producer → queue is fire-and-forget. The flush worker owns transaction boundaries.</figcaption>
  </figure>
</section>

<section style="margin-bottom: 56px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
    <span class="section-num">03</span>
    <h2 class="h-section">Schema migration</h2>
  </div>
  <pre class="code"><code><span class="cm">-- migrations/20260512_audit_log.sql</span>
<span class="kw">create table</span> <span class="fn">audit_events</span> (
  id           uuid <span class="kw">primary key default</span> gen_random_uuid(),
  actor_id     uuid <span class="kw">not null</span>,
  action       text <span class="kw">not null</span>,
  target_type  text <span class="kw">not null</span>,
  target_id    uuid <span class="kw">not null</span>,
  payload      jsonb <span class="kw">not null default</span> <span class="str">'{}'</span>::jsonb,
  created_at   timestamptz <span class="kw">not null default</span> now()
);

<span class="kw">create index</span> <span class="fn">audit_events_by_actor</span>
  <span class="kw">on</span> audit_events (actor_id, created_at <span class="kw">desc</span>);

<span class="kw">create index</span> <span class="fn">audit_events_by_target</span>
  <span class="kw">on</span> audit_events (target_type, target_id, created_at <span class="kw">desc</span>);
</code></pre>
</section>

<section style="margin-bottom: 56px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
    <span class="section-num">04</span>
    <h2 class="h-section">Risks &amp; mitigations</h2>
  </div>
  <table class="risk-table">
    <thead><tr><th>Risk</th><th>Likelihood</th><th>Impact</th><th>Mitigation</th></tr></thead>
    <tbody>
      <tr>
        <td>Write amplification under load — every action is a row</td>
        <td><span class="pill">high</span></td>
        <td><span class="pill">high</span></td>
        <td>Batched flush; partition <code>audit_events</code> monthly from day 1.</td>
      </tr>
      <tr>
        <td>PII leakage via the <code>payload</code> jsonb field</td>
        <td><span class="pill">med</span></td>
        <td><span class="pill">high</span></td>
        <td>Allow-list of fields per action type; reject at the service layer; audit the audit.</td>
      </tr>
      <tr>
        <td>Query performance on multi-month windows</td>
        <td><span class="pill">med</span></td>
        <td><span class="pill">med</span></td>
        <td>Cursor pagination + cap window to 90 days for the v1 read API.</td>
      </tr>
    </tbody>
  </table>
</section>

<section>
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
    <span class="section-num">05</span>
    <h2 class="h-section">Open questions</h2>
  </div>
  <div class="callout note">
    <strong>Retention policy</strong> — 90 days online, then cold storage? Or full retention
    indefinitely? Decide with platform before slice 4.
  </div>
  <div class="callout note" style="margin-top: 16px;">
    <strong>Service auth</strong> — does the audit reader require a step-up? Internal-only
    is fine for v1, but the next sweep will expose this to support.
  </div>
</section>`;

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW — annotated code review
// ─────────────────────────────────────────────────────────────────────────────

const REVIEW_BODY = `<header style="margin-bottom: 48px; max-width: 820px;">
  <div class="eyebrow">Code review · feature/auth-rewrite</div>
  <h1 class="h-display">Token storage refactor</h1>
  <div class="tldr">
    <strong>Approve with comments.</strong> Three notes inline — none blocking. The
    rotation flow is cleaner than the old one and the new types catch a class of
    bug we kept hitting. Ship it after addressing the migration backfill (#2).
  </div>
</header>

<section style="margin-bottom: 48px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px;">
    <span class="section-num">01</span>
    <h2 class="h-section">Files changed</h2>
  </div>

  <div style="margin-bottom: 32px;">
    <div class="eyebrow" style="font-family: var(--mono);">lib/auth/tokens.ts</div>
    <pre class="code" style="margin-top: 8px;"><code><span class="kw">export async function</span> <span class="fn">rotateToken</span>(userId: <span class="kw">string</span>): <span class="kw">Promise</span>&lt;<span class="kw">Token</span>&gt; {
  <span class="cm">// Rotate within a single transaction so a crash mid-rotation</span>
  <span class="cm">// can't leave a user with two valid tokens.</span>
  <span class="kw">return</span> db.<span class="fn">tx</span>(<span class="kw">async</span> (t) =&gt; {
    <span class="kw">await</span> t.<span class="fn">execute</span>(
      <span class="str">\\\`update tokens set revoked_at = now() where user_id = $1 and revoked_at is null\\\`</span>,
      [userId],
    );
    <span class="kw">return</span> t.<span class="fn">insertOne</span>(<span class="str">"tokens"</span>, { user_id: userId, value: <span class="fn">randomToken</span>() });
  });
}
</code></pre>
    <div class="callout note" style="margin-top: 12px;">
      Consider exposing <code>lastRotatedAt</code> on the token row so we can audit
      rotation lag without joining against revoked_at maxes.
    </div>
  </div>

  <div style="margin-bottom: 32px;">
    <div class="eyebrow" style="font-family: var(--mono);">migrations/20260511_token_rotation.sql</div>
    <pre class="code" style="margin-top: 8px;"><code><span class="kw">alter table</span> tokens
  <span class="kw">add column</span> revoked_at timestamptz,
  <span class="kw">add column</span> last_rotated_at timestamptz <span class="kw">not null default</span> now();
</code></pre>
    <div class="callout warn" style="margin-top: 12px;">
      <strong>Backfill required.</strong> Adding a non-null column to a populated table
      will block on rewrite if we don't add the default-then-populate-then-tighten
      dance. Move this into the rollout script.
    </div>
  </div>

  <div>
    <div class="eyebrow" style="font-family: var(--mono);">tests/auth/tokens.test.ts</div>
    <pre class="code" style="margin-top: 8px;"><code><span class="fn">test</span>(<span class="str">"rotation revokes the previous token"</span>, <span class="kw">async</span> () =&gt; {
  <span class="kw">const</span> t1 = <span class="kw">await</span> <span class="fn">issueToken</span>(<span class="str">"user-1"</span>);
  <span class="kw">const</span> t2 = <span class="kw">await</span> <span class="fn">rotateToken</span>(<span class="str">"user-1"</span>);
  <span class="fn">expect</span>(<span class="kw">await</span> <span class="fn">isValid</span>(t1.value)).<span class="fn">toBe</span>(<span class="kw">false</span>);
  <span class="fn">expect</span>(<span class="kw">await</span> <span class="fn">isValid</span>(t2.value)).<span class="fn">toBe</span>(<span class="kw">true</span>);
});
</code></pre>
    <div class="callout note" style="margin-top: 12px;">
      Missing a test for the rotation race when two requests arrive within the same
      millisecond. The transaction protects us, but a regression test would pin it.
    </div>
  </div>
</section>

<section style="margin-bottom: 48px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px;">
    <span class="section-num">02</span>
    <h2 class="h-section">Strengths &amp; concerns</h2>
  </div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px;">
    <div class="card">
      <div class="eyebrow">Strengths</div>
      <ul style="margin-top: 8px; padding-left: 20px;">
        <li>Single-transaction rotation eliminates the dual-token window.</li>
        <li>The new <code>Token</code> branded type catches three callers that were passing raw strings.</li>
        <li>Rotation metrics are emitted from one place — easier to alert on.</li>
      </ul>
    </div>
    <div class="card">
      <div class="eyebrow">Concerns</div>
      <ul style="margin-top: 8px; padding-left: 20px;">
        <li>Migration needs the safe-rollout pattern — see #2 above.</li>
        <li>No back-compat for tokens issued before this change. The session table still references them.</li>
      </ul>
    </div>
  </div>
</section>

<section>
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px;">
    <span class="section-num">03</span>
    <h2 class="h-section">Test-coverage gaps</h2>
  </div>
  <table class="risk-table">
    <thead><tr><th>Gap</th><th>Severity</th><th>Suggested test</th></tr></thead>
    <tbody>
      <tr>
        <td>Rotation race within same millisecond</td>
        <td><span class="pill">low</span></td>
        <td>Concurrent <code>rotateToken</code> for the same user; assert one revoke wins.</td>
      </tr>
      <tr>
        <td>Migration on a populated table</td>
        <td><span class="pill">med</span></td>
        <td>Integration test against a Postgres seeded with 10k token rows; assert no lock timeout.</td>
      </tr>
    </tbody>
  </table>
</section>`;

// ─────────────────────────────────────────────────────────────────────────────
// COMPARISON — three-way decision matrix
// ─────────────────────────────────────────────────────────────────────────────

const COMPARISON_BODY = `<header style="margin-bottom: 48px; max-width: 820px;">
  <div class="eyebrow">Decision matrix · acme/platform</div>
  <h1 class="h-display">Where should audit logs live?</h1>
  <div class="tldr">
    <strong>Recommendation: Postgres on the existing primary.</strong> ClickHouse buys
    throughput we don't yet need and adds an ops surface; SQLite would force a
    separate replication story. Postgres lets us ship slice 1 this week and migrate
    later if write rate forces it.
  </div>
</header>

<section style="margin-bottom: 48px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px;">
    <span class="section-num">01</span>
    <h2 class="h-section">Options at a glance</h2>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;">

    <div class="card">
      <div class="eyebrow">Option A</div>
      <h3 style="font-family: var(--serif); font-size: 22px; margin: 4px 0 12px;">Postgres</h3>
      <p style="color: var(--muted); font-size: 14px; margin-bottom: 12px;">
        Reuse the existing primary with a dedicated schema and partition strategy.
      </p>
      <ul style="font-size: 13.5px; padding-left: 20px; margin-bottom: 12px;">
        <li>No new infra.</li>
        <li>Joins with <code>users</code> and <code>orgs</code> for free.</li>
        <li>Write rate ceiling at ~5k/s before tuning.</li>
      </ul>
      <div style="font-size: 13px;"><strong>Fit:</strong> <span class="pill">recommended</span></div>
    </div>

    <div class="card">
      <div class="eyebrow">Option B</div>
      <h3 style="font-family: var(--serif); font-size: 22px; margin: 4px 0 12px;">ClickHouse</h3>
      <p style="color: var(--muted); font-size: 14px; margin-bottom: 12px;">
        Columnar, MergeTree-backed analytics store. Excellent for time-series scans.
      </p>
      <ul style="font-size: 13.5px; padding-left: 20px; margin-bottom: 12px;">
        <li>50k+ writes/s without breaking a sweat.</li>
        <li>Compression saves ~70 % vs row-store on logs.</li>
        <li>New ops surface, new on-call training.</li>
      </ul>
      <div style="font-size: 13px;"><strong>Fit:</strong> <span class="pill">premature</span></div>
    </div>

    <div class="card">
      <div class="eyebrow">Option C</div>
      <h3 style="font-family: var(--serif); font-size: 22px; margin: 4px 0 12px;">SQLite per-shard</h3>
      <p style="color: var(--muted); font-size: 14px; margin-bottom: 12px;">
        One audit DB file per service shard, replicated via Litestream.
      </p>
      <ul style="font-size: 13.5px; padding-left: 20px; margin-bottom: 12px;">
        <li>Trivially fast on a single host.</li>
        <li>Cheap, simple ops at small scale.</li>
        <li>No cross-shard queries; replication adds a moving piece.</li>
      </ul>
      <div style="font-size: 13px;"><strong>Fit:</strong> <span class="pill">poor</span></div>
    </div>

  </div>
</section>

<section style="margin-bottom: 48px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px;">
    <span class="section-num">02</span>
    <h2 class="h-section">Side by side</h2>
  </div>
  <table class="compare-table">
    <thead>
      <tr><th>Criterion</th><th>Postgres</th><th>ClickHouse</th><th>SQLite</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Write throughput (single host)</td>
        <td>~5 k/s tuned</td>
        <td>50 k+ /s</td>
        <td>~10 k/s on NVMe</td>
      </tr>
      <tr>
        <td>Retention &amp; cold storage</td>
        <td>Partition + archive script</td>
        <td>TTL on parts, S3 disk</td>
        <td>Manual; per-file rotation</td>
      </tr>
      <tr>
        <td>Ops complexity (delta from today)</td>
        <td>None</td>
        <td>New cluster, new alerts</td>
        <td>New replication path</td>
      </tr>
      <tr>
        <td>Query patterns we need v1</td>
        <td>Covered</td>
        <td>Covered + analytical</td>
        <td>Per-shard only</td>
      </tr>
      <tr>
        <td>Cost (incremental)</td>
        <td>~$0</td>
        <td>~$2–4k/mo at fleet</td>
        <td>~$0; storage spread</td>
      </tr>
      <tr>
        <td>Fit with current stack</td>
        <td>Native</td>
        <td>Adjacent</td>
        <td>Awkward</td>
      </tr>
    </tbody>
  </table>
</section>

<section style="margin-bottom: 48px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px;">
    <span class="section-num">03</span>
    <h2 class="h-section">Why Postgres</h2>
  </div>
  <p style="margin-bottom: 12px;">
    Our v1 query patterns are bounded — by actor, by target, time-windowed, with
    pagination — and Postgres serves them without strain on any reasonable hardware
    we already operate. The composite indexes pay for themselves within the
    first month's data.
  </p>
  <p style="margin-bottom: 12px;">
    The case for ClickHouse only becomes compelling when we want analytical
    aggregates over the full history. We don't, today. When we do, the migration
    is mechanical: dump partitions to a ClickHouse table, switch the read path,
    keep Postgres as the write-through truth-of-record for compliance.
  </p>
  <p>
    SQLite is genuinely tempting for the per-service simplicity, but the cost of
    losing cross-org queries is exactly the thing the audit log exists to enable.
  </p>
</section>

<section>
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px;">
    <span class="section-num">04</span>
    <h2 class="h-section">Follow-ups</h2>
  </div>
  <div class="callout note">
    See follow-up RFC: <em>Retention &amp; cold-storage tiers</em>. Decision can wait
    until we have a month of real production write volume to size against.
  </div>
</section>`;

// ─────────────────────────────────────────────────────────────────────────────
// EXPLAINER — research-mode feature explainer
// ─────────────────────────────────────────────────────────────────────────────

const EXPLAINER_BODY = `<style>
  details {
    border: 1.5px solid var(--rule); border-radius: 12px;
    background: var(--surface); margin: 12px 0; overflow: hidden;
  }
  details > summary {
    list-style: none; cursor: pointer; padding: 14px 18px;
    font-family: var(--serif); font-size: 17px; color: var(--ink);
    display: flex; align-items: baseline; gap: 10px;
  }
  details > summary::-webkit-details-marker { display: none; }
  details > summary::before {
    content: "▸"; color: var(--accent); font-family: var(--sans);
    font-size: 12px; transition: transform 120ms;
  }
  details[open] > summary::before { transform: rotate(90deg); }
  details > summary .where {
    font-family: var(--mono); font-size: 11.5px; color: var(--muted);
    margin-left: auto;
  }
  details > .body { padding: 0 18px 16px; }
  .tabs {
    border: 1.5px solid var(--rule); border-radius: 12px;
    background: var(--surface); overflow: hidden; margin: 16px 0;
  }
  .tabs > .bar {
    display: flex; border-bottom: 1.5px solid var(--rule);
    background: var(--surface-2);
  }
  .tabs > .bar > button {
    appearance: none; border: 0; background: none;
    font-family: var(--mono); font-size: 12.5px; color: var(--muted);
    padding: 10px 16px; cursor: pointer; border-right: 1px solid var(--rule);
  }
  .tabs > .bar > button.on {
    background: var(--surface); color: var(--ink);
    border-bottom: 2px solid var(--accent); margin-bottom: -1.5px;
  }
  .tabs > pre { display: none; margin: 0; padding: 16px 18px; }
  .tabs > pre.on { display: block; }
</style>

<header style="margin-bottom: 48px; max-width: 820px;">
  <div class="eyebrow">Research · feature explainer</div>
  <h1 class="h-display">How rate limiting works in <code>cesium-style/api</code></h1>
  <div class="tldr">
    Every request passes through <code>rateLimit()</code> middleware. It resolves the
    caller to a bucket key, runs an atomic Redis token-bucket update via Lua, and
    returns <code>429</code> with <code>Retry-After</code> when the bucket is empty.
    Limits are per-route in <code>config/limits.yaml</code>; routes without an entry
    inherit the <code>default</code> tier (100 req/min per API key).
  </div>
</header>

<section style="margin-bottom: 48px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
    <span class="section-num">01</span>
    <h2 class="h-section">The request path, step by step</h2>
  </div>
  <p style="color: var(--muted); margin-bottom: 16px;">
    Expand each step. The whole path is roughly 40 lines and adds about 0.4 ms p50
    to every request.
  </p>

  <details open>
    <summary>1 · Identify the caller <span class="where">middleware/ratelimit.ts:21</span></summary>
    <div class="body">
      The middleware reduces the request to a <code>bucketKey</code>: API key if the
      <code>Authorization</code> header is present, otherwise the client IP via the
      <code>x-forwarded-for</code> chain (trusting only our own LB). Anonymous IP
      traffic gets a much lower default tier.
    </div>
  </details>

  <details>
    <summary>2 · Look up the bucket <span class="where">lib/tokenBucket.ts:9</span></summary>
    <div class="body">
      Route name + bucket key map to a Redis hash <code>rl:{route}:{key}</code> holding
      <code>tokens</code> and <code>updatedAt</code>. Missing keys are created lazily
      at full capacity — there's no warm-up.
    </div>
  </details>

  <details>
    <summary>3 · Refill and consume <span class="where">lib/tokenBucket.ts:31</span></summary>
    <div class="body">
      Refill is computed from elapsed time (<code>rate × Δt</code>, capped at
      <code>burst</code>), then one token is subtracted. The whole read-modify-write
      runs as a single Lua script so concurrent requests can't double-spend.
    </div>
  </details>

  <details>
    <summary>4 · Reject when empty <span class="where">middleware/ratelimit.ts:48</span></summary>
    <div class="body">
      If the script returns <code>tokens &lt; 0</code> the middleware short-circuits
      with <code>429 Too Many Requests</code> and sets <code>Retry-After</code> to
      the seconds until one token refills. Successful responses always carry
      <code>X-RateLimit-Remaining</code>.
    </div>
  </details>
</section>

<section style="margin-bottom: 48px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
    <span class="section-num">02</span>
    <h2 class="h-section">Configuring a limit on your route</h2>
  </div>
  <p style="color: var(--muted); margin-bottom: 8px;">
    You don't touch the middleware. Add an entry to <code>config/limits.yaml</code>
    keyed by route name and (optionally) wrap the handler.
  </p>
  <div class="tabs" data-tabs>
    <div class="bar">
      <button class="on" data-t="0">limits.yaml</button>
      <button data-t="1">route.ts</button>
      <button data-t="2">client response</button>
    </div>
    <pre class="code on"><code><span class="cm"># config/limits.yaml</span>
default:
  rate: 100/min
  burst: 120

<span class="kw">search.query</span>:
  rate: 20/min
  burst: 40
  key: api_key       <span class="cm"># or: ip</span>
</code></pre>
    <pre class="code"><code><span class="cm">// routes/search.ts</span>
router.<span class="fn">post</span>(
  <span class="str">"/search"</span>,
  <span class="fn">rateLimit</span>(<span class="str">"search.query"</span>),
  handler,
);
</code></pre>
    <pre class="code"><code>HTTP/1.1 429 Too Many Requests
Retry-After: 17
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 0

{ <span class="str">"error"</span>: <span class="str">"rate_limited"</span>, <span class="str">"retry_after"</span>: 17 }
</code></pre>
  </div>
  <div class="callout note" style="margin-top: 16px;">
    If you only need the default tier, no YAML entry needed — just wrap with
    <code>rateLimit()</code> and the route name is inferred from the path.
  </div>
</section>

<section style="margin-bottom: 48px;">
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
    <span class="section-num">03</span>
    <h2 class="h-section">Gotchas worth knowing</h2>
  </div>
  <div class="card">
    <ul style="padding-left: 20px;">
      <li style="margin-bottom: 8px;">
        <strong>Limits are per-process in dev.</strong> The Redis client falls back to
        an in-memory map when <code>REDIS_URL</code> is unset, so local testing
        won't reflect cluster behaviour.
      </li>
      <li style="margin-bottom: 8px;">
        <strong>Burst ≠ rate.</strong> <code>burst</code> is bucket capacity; an idle
        caller can fire <code>burst</code> requests instantly even if
        <code>rate</code> is low.
      </li>
      <li>
        <strong>Streaming responses count once.</strong> The token is consumed at
        request start; a 30-second SSE stream still costs one token.
      </li>
    </ul>
  </div>
</section>

<section>
  <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
    <span class="section-num">04</span>
    <h2 class="h-section">FAQ</h2>
  </div>
  <dl style="margin-top: 8px;">
    <dt style="font-family: var(--serif); font-size: 17px; color: var(--ink); margin-top: 16px;">
      How do I exempt internal traffic?
    </dt>
    <dd style="margin: 4px 0 0; color: var(--ink-soft); max-width: 720px;">
      Set <code>x-acme-internal: 1</code> from the caller; the middleware checks it
      against the mTLS peer name and skips the bucket entirely.
    </dd>
    <dt style="font-family: var(--serif); font-size: 17px; color: var(--ink); margin-top: 16px;">
      Where do I see who's getting limited?
    </dt>
    <dd style="margin: 4px 0 0; color: var(--ink-soft); max-width: 720px;">
      Every <code>429</code> emits a <code>ratelimit.rejected</code> metric tagged
      with route and key type. There's a Grafana panel under <em>API → Health</em>.
    </dd>
    <dt style="font-family: var(--serif); font-size: 17px; color: var(--ink); margin-top: 16px;">
      Can a single user have a higher limit?
    </dt>
    <dd style="margin: 4px 0 0; color: var(--ink-soft); max-width: 720px;">
      Add the API key under <code>overrides:</code> in the YAML. Overrides are
      reloaded without a deploy.
    </dd>
  </dl>
</section>

<script>
  document.querySelectorAll("[data-tabs]").forEach((box) => {
    const btns = box.querySelectorAll("button");
    const panes = box.querySelectorAll("pre");
    btns.forEach((b, i) => {
      b.addEventListener("click", () => {
        btns.forEach((x) => x.classList.remove("on"));
        panes.forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        panes[i].classList.add("on");
      });
    });
  });
</script>`;

// ─────────────────────────────────────────────────────────────────────────────
// Bake
// ─────────────────────────────────────────────────────────────────────────────

const EXAMPLES: Example[] = [
  {
    filename: "plan.html",
    meta: makeMeta({
      id: "PlnA01",
      title: "Audit log for user actions",
      kind: "plan",
      summary: "Append-only audit log behind audit_log_v1, rolled out in four reviewable slices.",
      tags: ["api", "platform", "audit"],
    }),
    body: PLAN_BODY,
  },
  {
    filename: "review.html",
    meta: makeMeta({
      id: "RvwB02",
      title: "Token storage refactor",
      kind: "review",
      summary: "Approve with comments — three notes inline, none blocking.",
      tags: ["auth", "security"],
    }),
    body: REVIEW_BODY,
  },
  {
    filename: "comparison.html",
    meta: makeMeta({
      id: "CmpC03",
      title: "Where should audit logs live?",
      kind: "comparison",
      summary: "Postgres vs ClickHouse vs SQLite for the audit log. Postgres wins for v1.",
      tags: ["platform", "decision"],
    }),
    body: COMPARISON_BODY,
  },
  {
    filename: "explainer.html",
    meta: makeMeta({
      id: "ExpD04",
      title: "How rate limiting works in cesium-style/api",
      kind: "explainer",
      summary: "Walks the request path from middleware through the Redis token-bucket script.",
      tags: ["docs", "infra"],
    }),
    body: EXPLAINER_BODY,
  },
];

for (const example of EXAMPLES) {
  const html = wrapDocument({
    body: example.body,
    meta: example.meta,
    theme: defaultTheme(),
    themeCssHref: "theme.css",
  });
  const outPath = join(examplesDir, example.filename);
  // Trailing newline so the file is canonical for `oxfmt`.
  writeFileSync(outPath, html + "\n");
  console.log(`baked ${example.filename} (${html.length + 1} bytes)`);
}

// Write theme.css alongside the examples (deterministic artifact of default theme)
await writeThemeCss(examplesDir, defaultTheme());
console.log("baked theme.css");

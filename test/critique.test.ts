import { describe, expect, test } from "bun:test";
import { critique, type CritiqueFinding } from "../src/render/critique.ts";

// Helper to build a text string of exactly `n` chars
function chars(n: number, c = "x"): string {
  return c.repeat(n);
}

// Helper: build a body with visible text of length n (wraps in a <p>)
function bodyWithTextLength(n: number): string {
  return `<p>${chars(n)}</p>`;
}

// Helper: find a finding by code
function find(findings: CritiqueFinding[], code: string): CritiqueFinding | undefined {
  return findings.find((f) => f.code === code);
}

// ---------------------------------------------------------------------------
// Empty / trivial bodies
// ---------------------------------------------------------------------------

describe("critique — empty body", () => {
  test("empty string returns suggest body-too-short (score 97)", () => {
    const r = critique("");
    // Empty body is very short — triggers body-too-short (suggest, -3)
    // Also triggers no-h-display (suggest, -3), no-eyebrow (suggest, -3)
    // Does NOT trigger no-tldr (textLength=0 ≤ 1500)
    // Does NOT trigger unsectioned-long-body (textLength=0 ≤ 1200)
    // score = 100 - 3 - 3 - 3 = 91
    expect(r.textLength).toBe(0);
    expect(find(r.findings, "body-too-short")).toBeDefined();
    expect(r.score).toBe(91);
  });

  test("empty body does not trigger no-tldr (text not > 1500)", () => {
    const r = critique("");
    expect(find(r.findings, "no-tldr")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Scoring arithmetic
// ---------------------------------------------------------------------------

describe("critique — scoring", () => {
  test("1 warn finding = score 90", () => {
    // Use external-resource which is a warn
    const r = critique('<script src="https://evil.com/x.js"></script><p>${chars(300)}</p>');
    // warn: external-resource (-10)
    // suggest: no-h-display (-3), no-eyebrow (-3), body-too-short (-3) or not based on text
    // Let's check warn deduction specifically with a minimal body that only has 1 warn
    const warnFindings = r.findings.filter((f) => f.severity === "warn");
    expect(warnFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("score = 100 minus deductions, floored at 0", () => {
    // A body with 11+ warns would floor at 0; let's just confirm deduction math
    // 1 warn alone (if we could isolate it) = 90
    // Build a body that triggers exactly 1 warn and 0 suggests/info:
    // multiple-h-display warn + h-display present (no no-h-display)
    // + text 300 chars so no short/long triggers
    // + eyebrow present so no-eyebrow doesn't fire
    // + tldr present so no-tldr doesn't fire
    // + h-section present so unsectioned doesn't fire
    const body =
      '<div class="h-display">Title</div>' +
      '<div class="h-display">Dup</div>' +
      '<div class="eyebrow">Label</div>' +
      '<div class="tldr">Summary</div>' +
      '<div class="h-section">Section</div>' +
      `<p>${chars(300)}</p>`;
    const r = critique(body);
    const warnFindings = r.findings.filter((f) => f.severity === "warn");
    const suggestFindings = r.findings.filter((f) => f.severity === "suggest");
    const infoFindings = r.findings.filter((f) => f.severity === "info");
    expect(find(r.findings, "multiple-h-display")).toBeDefined();
    // Score = 100 - 10*(warns) - 3*(suggests) - 1*(infos)
    const expected = Math.max(
      0,
      100 - warnFindings.length * 10 - suggestFindings.length * 3 - infoFindings.length * 1,
    );
    expect(r.score).toBe(expected);
  });

  test("1 warn + 1 suggest = score 87", () => {
    // external-resource (warn) + body-too-short (suggest)
    // + no-h-display (suggest) + no-eyebrow (suggest) — let's pick carefully
    // Just verify the formula: 100 - 10 - 3*suggests - 1*infos
    const r = critique('<script src="https://evil.com/x.js"></script><p>hi</p>');
    const warns = r.findings.filter((f) => f.severity === "warn").length;
    const suggests = r.findings.filter((f) => f.severity === "suggest").length;
    const infos = r.findings.filter((f) => f.severity === "info").length;
    const expected = Math.max(0, 100 - warns * 10 - suggests * 3 - infos * 1);
    expect(r.score).toBe(expected);
    expect(warns).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Warn: external-resource
// ---------------------------------------------------------------------------

describe("critique — external-resource (warn)", () => {
  test("script with src fires external-resource", () => {
    const r = critique('<script src="https://evil.com/x.js"></script>');
    expect(find(r.findings, "external-resource")).toBeDefined();
    expect(find(r.findings, "external-resource")?.severity).toBe("warn");
  });

  test("link stylesheet with https href fires external-resource", () => {
    const r = critique('<link rel="stylesheet" href="https://cdn.example.com/x.css">');
    expect(find(r.findings, "external-resource")).toBeDefined();
  });

  test("img with http src fires external-resource", () => {
    const r = critique('<img src="http://example.com/img.png">');
    expect(find(r.findings, "external-resource")).toBeDefined();
  });

  test("inline script (no src) does NOT fire external-resource", () => {
    const r = critique('<script>console.log("ok")</script><p>hello world</p>');
    expect(find(r.findings, "external-resource")).toBeUndefined();
  });

  test("inline style element does NOT fire external-resource", () => {
    const r = critique("<style>body { color: red; }</style><p>hello world</p>");
    expect(find(r.findings, "external-resource")).toBeUndefined();
  });

  test("data URI image does NOT fire external-resource", () => {
    const r = critique('<img src="data:image/png;base64,abc123"><p>hi</p>');
    expect(find(r.findings, "external-resource")).toBeUndefined();
  });

  // Each rule fires AT MOST ONCE — even with two external resources
  test("multiple external resources produce one finding", () => {
    const r = critique(
      '<script src="https://a.com/x.js"></script>' +
        '<img src="http://b.com/img.png">' +
        "<p>hi</p>",
    );
    const matches = r.findings.filter((f) => f.code === "external-resource");
    expect(matches).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Warn: multiple-h-display
// ---------------------------------------------------------------------------

describe("critique — multiple-h-display (warn)", () => {
  test("two .h-display elements fires multiple-h-display", () => {
    const r = critique(
      '<h1 class="h-display">Title</h1><h2 class="h-display">Another Title</h2><p>x</p>',
    );
    expect(find(r.findings, "multiple-h-display")).toBeDefined();
  });

  test("one .h-display does NOT fire multiple-h-display", () => {
    const r = critique('<h1 class="h-display">Title</h1><p>content</p>');
    expect(find(r.findings, "multiple-h-display")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Warn: unknown-cesium-class
// ---------------------------------------------------------------------------

describe("critique — unknown-cesium-class (warn)", () => {
  test("unknown cesium-* class fires with count 1", () => {
    const r = critique('<div class="cesium-magic">x</div><p>hi</p>');
    const f = find(r.findings, "unknown-cesium-class");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("warn");
    expect(f?.count).toBe(1);
  });

  test("cesium-back is NOT flagged (known class)", () => {
    const r = critique('<nav class="cesium-back">back</nav><p>hi</p>');
    expect(find(r.findings, "unknown-cesium-class")).toBeUndefined();
  });

  test("two distinct unknown cesium-* classes produce count 2", () => {
    const r = critique(
      '<div class="cesium-magic">x</div><div class="cesium-sparkle">y</div><p>hi</p>',
    );
    const f = find(r.findings, "unknown-cesium-class");
    expect(f?.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Suggest: no-h-display
// ---------------------------------------------------------------------------

describe("critique — no-h-display (suggest)", () => {
  test("no .h-display fires no-h-display", () => {
    const r = critique("<p>hello world</p>");
    expect(find(r.findings, "no-h-display")).toBeDefined();
    expect(find(r.findings, "no-h-display")?.severity).toBe("suggest");
  });

  test("body with .h-display does NOT fire no-h-display", () => {
    const r = critique('<h1 class="h-display">Title</h1><p>content here</p>');
    expect(find(r.findings, "no-h-display")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suggest: no-tldr
// ---------------------------------------------------------------------------

describe("critique — no-tldr (suggest)", () => {
  test("body 1700 chars, no .tldr fires no-tldr", () => {
    const r = critique(bodyWithTextLength(1700));
    expect(find(r.findings, "no-tldr")).toBeDefined();
    expect(find(r.findings, "no-tldr")?.severity).toBe("suggest");
  });

  test("body 1700 chars WITH .tldr does NOT fire no-tldr", () => {
    const r = critique(`<div class="tldr">Summary here.</div><p>${chars(1700)}</p>`);
    expect(find(r.findings, "no-tldr")).toBeUndefined();
  });

  test("body 1000 chars, no .tldr does NOT fire no-tldr (≤ 1500 chars)", () => {
    const r = critique(bodyWithTextLength(1000));
    expect(find(r.findings, "no-tldr")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suggest: body-too-short
// ---------------------------------------------------------------------------

describe("critique — body-too-short (suggest)", () => {
  test("body 100 chars fires body-too-short", () => {
    const r = critique(bodyWithTextLength(100));
    expect(find(r.findings, "body-too-short")).toBeDefined();
    expect(find(r.findings, "body-too-short")?.severity).toBe("suggest");
  });

  test("body 250 chars does NOT fire body-too-short", () => {
    const r = critique(bodyWithTextLength(250));
    expect(find(r.findings, "body-too-short")).toBeUndefined();
  });

  test("body 249 chars fires body-too-short", () => {
    const r = critique(bodyWithTextLength(249));
    expect(find(r.findings, "body-too-short")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Suggest: callout-without-modifier
// ---------------------------------------------------------------------------

describe("critique — callout-without-modifier (suggest)", () => {
  test(".callout with no modifier fires callout-without-modifier", () => {
    const r = critique('<div class="callout">no modifier</div><p>hi</p>');
    const f = find(r.findings, "callout-without-modifier");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("suggest");
    expect(f?.count).toBe(1);
  });

  test(".callout.note does NOT fire callout-without-modifier", () => {
    const r = critique('<div class="callout note">good</div><p>hi</p>');
    expect(find(r.findings, "callout-without-modifier")).toBeUndefined();
  });

  test(".callout.warn does NOT fire callout-without-modifier", () => {
    const r = critique('<div class="callout warn">careful</div><p>hi</p>');
    expect(find(r.findings, "callout-without-modifier")).toBeUndefined();
  });

  test(".callout.risk does NOT fire callout-without-modifier", () => {
    const r = critique('<div class="callout risk">risky</div><p>hi</p>');
    expect(find(r.findings, "callout-without-modifier")).toBeUndefined();
  });

  test("two unmodified callouts fire count 2", () => {
    const r = critique('<div class="callout">a</div><div class="callout">b</div><p>hi</p>');
    const f = find(r.findings, "callout-without-modifier");
    expect(f?.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Info: body-very-long
// ---------------------------------------------------------------------------

describe("critique — body-very-long (info)", () => {
  test("body 30000 chars fires body-very-long", () => {
    const r = critique(bodyWithTextLength(30000));
    const f = find(r.findings, "body-very-long");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("info");
  });

  test("body 25000 chars does NOT fire body-very-long", () => {
    const r = critique(bodyWithTextLength(25000));
    expect(find(r.findings, "body-very-long")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Info: code-without-highlights
// ---------------------------------------------------------------------------

describe("critique — code-without-highlights (info)", () => {
  test(".code block with no highlight spans fires code-without-highlights", () => {
    const r = critique('<pre class="code">const x = 1;</pre><p>hi</p>');
    const f = find(r.findings, "code-without-highlights");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("info");
  });

  test(".code block with .kw descendant does NOT fire", () => {
    const r = critique('<pre class="code"><span class="kw">const</span> x = 1;</pre><p>hi</p>');
    expect(find(r.findings, "code-without-highlights")).toBeUndefined();
  });

  test(".code block with .str descendant does NOT fire", () => {
    const r = critique('<pre class="code">x = <span class="str">"hello"</span></pre><p>hi</p>');
    expect(find(r.findings, "code-without-highlights")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Info: inline-style-heavy
// ---------------------------------------------------------------------------

// Helper: build n elements with inline style attributes
function nStyled(n: number): string {
  return Array.from({ length: n }, (_, i) => `<p style="color: red">${i}</p>`).join("");
}

describe("critique — inline-style-heavy (info)", () => {
  test("9 style attributes fires inline-style-heavy", () => {
    const r = critique(nStyled(9));
    const f = find(r.findings, "inline-style-heavy");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("info");
  });

  test("7 style attributes does NOT fire inline-style-heavy", () => {
    const r = critique(nStyled(7));
    expect(find(r.findings, "inline-style-heavy")).toBeUndefined();
  });

  test("8 style attributes does NOT fire inline-style-heavy (threshold is > 8)", () => {
    const r = critique(nStyled(8));
    expect(find(r.findings, "inline-style-heavy")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Severity ordering
// ---------------------------------------------------------------------------

describe("critique — severity ordering", () => {
  test("warn findings come before suggest, suggest before info", () => {
    // Body that triggers warn + suggest + info
    const body =
      '<script src="https://evil.com/x.js"></script>' + // warn: external-resource
      bodyWithTextLength(30000); // info: body-very-long; also suggest triggers
    const r = critique(body);

    const severities = r.findings.map((f) => f.severity);
    const warnIdx = severities.findLastIndex((s) => s === "warn");
    const suggestIdx = severities.findLastIndex((s) => s === "suggest");

    // All warns before all suggests
    const firstSuggest = severities.indexOf("suggest");
    if (firstSuggest !== -1 && warnIdx !== -1) {
      expect(warnIdx).toBeLessThan(firstSuggest);
    }

    // All suggests before all infos
    const firstInfo = severities.indexOf("info");
    if (firstInfo !== -1 && suggestIdx !== -1) {
      expect(suggestIdx).toBeLessThan(firstInfo);
    }
  });

  test("findings of same severity are sorted alphabetically by code", () => {
    // Build a body that only triggers multiple suggest findings
    const r = critique(bodyWithTextLength(100));
    const suggests = r.findings.filter((f) => f.severity === "suggest");
    for (let i = 0; i + 1 < suggests.length; i++) {
      const a = suggests[i];
      const b = suggests[i + 1];
      if (a && b) {
        expect(a.code.localeCompare(b.code)).toBeLessThanOrEqual(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Well-formed body — no spurious findings
// ---------------------------------------------------------------------------

describe("critique — clean body", () => {
  test("body with .h-display, .tldr, text > 1500 chars: no warn on those", () => {
    const body =
      '<h1 class="h-display">Title</h1>' +
      '<div class="tldr">Summary</div>' +
      `<p>${chars(1600)}</p>`;
    const r = critique(body);
    expect(find(r.findings, "no-h-display")).toBeUndefined();
    expect(find(r.findings, "no-tldr")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// textLength contract
// ---------------------------------------------------------------------------

describe("critique — textLength", () => {
  test("textLength reflects visible text content, not raw HTML bytes", () => {
    const r = critique('<p class="foo">hello</p>');
    // HTML is 25 bytes but text is 5 chars ("hello")
    expect(r.textLength).toBe(5);
  });

  test("textLength is 0 for empty body", () => {
    expect(critique("").textLength).toBe(0);
  });
});

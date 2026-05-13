import { describe, expect, test } from "bun:test";
import { wrapDocument, type ArtifactMeta } from "../src/render/wrap.ts";
import { defaultTheme } from "../src/render/theme.ts";
import type { InteractiveData } from "../src/render/validate.ts";

function unwrap<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${name} to be defined`);
  }
  return value;
}

function makeMeta(overrides?: Partial<ArtifactMeta>): ArtifactMeta {
  return {
    id: "a7K9pQ",
    title: "Auth Design",
    kind: "design",
    summary: "A plan for auth.",
    tags: ["auth", "security"],
    createdAt: "2026-05-11T14:22:09Z",
    model: "claude-opus",
    sessionId: "sess-123",
    projectSlug: "github-com-cfb-cesium",
    projectName: "cfb/cesium",
    cwd: "/Users/cfb/code/cesium",
    worktree: null,
    gitBranch: "main",
    gitCommit: "abc1234",
    supersedes: null,
    supersededBy: null,
    contentSha256: "deadbeef",
    inputMode: "html",
    ...overrides,
  };
}

describe("wrapDocument", () => {
  test("starts with <!doctype html>", () => {
    const doc = wrapDocument({
      body: "<h1>Hello</h1>",
      meta: makeMeta(),
      theme: defaultTheme(),
    });
    expect(doc).toMatch(/^<!doctype html>/i);
  });

  test("includes <title> with meta.title", () => {
    const doc = wrapDocument({
      body: "<p>body</p>",
      meta: makeMeta({ title: "My Plan" }),
      theme: defaultTheme(),
    });
    expect(doc).toContain("<title>My Plan · cesium</title>");
  });

  test("HTML-escapes title in <title>", () => {
    const doc = wrapDocument({
      body: "<p>body</p>",
      meta: makeMeta({ title: '<script>alert("xss")</script>' }),
      theme: defaultTheme(),
    });
    expect(doc).toContain("&lt;script&gt;");
    expect(doc).not.toContain('<script>alert("xss")</script>');
  });

  test("includes cesium-meta script with parseable JSON", () => {
    const meta = makeMeta();
    const doc = wrapDocument({ body: "<p>hi</p>", meta, theme: defaultTheme() });
    const match = /<script type="application\/json" id="cesium-meta">([\s\S]*?)<\/script>/i.exec(
      doc,
    );
    expect(match).not.toBeNull();
    const innerJson = match?.[1] ?? "";
    const parsed = JSON.parse(innerJson) as Record<string, unknown>;
    expect(parsed["id"]).toBe(meta.id);
    expect(parsed["title"]).toBe(meta.title);
    expect(parsed["kind"]).toBe(meta.kind);
    expect(parsed["tags"]).toEqual(meta.tags);
  });

  test("body content appears verbatim", () => {
    const body = '<section class="foo"><h2>Section</h2><p>Text here.</p></section>';
    const doc = wrapDocument({ body, meta: makeMeta(), theme: defaultTheme() });
    expect(doc).toContain(body);
  });

  test("includes warning callouts when warnings provided", () => {
    const doc = wrapDocument({
      body: "<p>body</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      warnings: ["External resource removed", "Another warning"],
    });
    expect(doc).toContain('class="callout warn"');
    expect(doc).toContain("External resource removed");
    expect(doc).toContain("Another warning");
  });

  test("no warnings when warnings array is empty", () => {
    const doc = wrapDocument({
      body: "<p>body</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      warnings: [],
    });
    // Should not have warning callouts if no warnings
    const warnCount = (doc.match(/class="callout warn"/g) ?? []).length;
    expect(warnCount).toBe(0);
  });

  test("no warnings when warnings not provided", () => {
    const doc = wrapDocument({ body: "<p>body</p>", meta: makeMeta(), theme: defaultTheme() });
    const warnCount = (doc.match(/class="callout warn"/g) ?? []).length;
    expect(warnCount).toBe(0);
  });

  test("escapes </script> inside metadata JSON", () => {
    const meta = makeMeta({ title: "Normal" });
    // Put </script> in a field
    const metaWithScript: ArtifactMeta = { ...meta, summary: "see </script> here" };
    const doc = wrapDocument({ body: "<p>hi</p>", meta: metaWithScript, theme: defaultTheme() });
    // The literal </script> must not appear raw inside the JSON block
    // Find the cesium-meta script block
    const scriptBlockMatch =
      /<script type="application\/json" id="cesium-meta">([\s\S]*?)<\/script>/i.exec(doc);
    expect(scriptBlockMatch).not.toBeNull();
    // The content inside should not contain unescaped </script>
    const innerContent = scriptBlockMatch?.[1] ?? "";
    expect(innerContent).not.toContain("</script>");
    expect(innerContent).toContain("<\\/script>");
  });

  test("includes footer with id and kind", () => {
    const meta = makeMeta({ id: "testid123", kind: "plan" });
    const doc = wrapDocument({ body: "<p>hi</p>", meta, theme: defaultTheme() });
    expect(doc).toContain("testid123");
    expect(doc).toContain("plan");
    expect(doc).toContain('class="byline"');
  });

  test("footer includes supersedes link when present", () => {
    const meta = makeMeta({ supersedes: "previd456" });
    const doc = wrapDocument({ body: "<p>hi</p>", meta, theme: defaultTheme() });
    expect(doc).toContain("previd456");
  });

  test("includes <style> with fallback css", () => {
    const doc = wrapDocument({ body: "<p>hi</p>", meta: makeMeta(), theme: defaultTheme() });
    expect(doc).toContain("<style>");
    expect(doc).toContain(":root");
    // fallback uses system-ui font stack
    expect(doc).toContain("system-ui");
  });

  test("includes a back nav linking to the project and global indexes", () => {
    const meta = makeMeta({ projectName: "cfbender/acme" });
    const doc = wrapDocument({ body: "<p>hi</p>", meta, theme: defaultTheme() });
    expect(doc).toContain('class="cesium-back"');
    expect(doc).toContain('href="../index.html"');
    expect(doc).toContain('href="../../../index.html"');
    expect(doc).toContain("← cfbender/acme");
    expect(doc).toContain("all projects");
  });

  test("back nav escapes the project name", () => {
    const meta = makeMeta({ projectName: '<script>alert("x")</script>' });
    const doc = wrapDocument({ body: "<p>hi</p>", meta, theme: defaultTheme() });
    expect(doc).not.toContain('<script>alert("x")</script>');
    expect(doc).toContain("&lt;script&gt;");
  });

  // ─── Dynamic theme link tests ──────────────────────────────────────────────

  test("default themeCssHref produces link to ../../../theme.css", () => {
    const doc = wrapDocument({ body: "<p>hi</p>", meta: makeMeta(), theme: defaultTheme() });
    expect(doc).toContain('<link rel="stylesheet" href="../../../theme.css">');
  });

  test("custom themeCssHref produces link with that exact path", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      themeCssHref: "theme.css",
    });
    expect(doc).toContain('<link rel="stylesheet" href="theme.css">');
    expect(doc).not.toContain('href="../../../theme.css"');
  });

  test("themeCssHref: null suppresses the <link> entirely", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      themeCssHref: null,
    });
    expect(doc).not.toContain('<link rel="stylesheet"');
  });

  test("inline <style> and <link> are BOTH present with default href", () => {
    const doc = wrapDocument({ body: "<p>hi</p>", meta: makeMeta(), theme: defaultTheme() });
    expect(doc).toContain("<style>");
    expect(doc).toContain('<link rel="stylesheet"');
  });

  test("<link> appears AFTER <style> in document order", () => {
    const doc = wrapDocument({ body: "<p>hi</p>", meta: makeMeta(), theme: defaultTheme() });
    const stylePos = doc.indexOf("<style>");
    const linkPos = doc.indexOf('<link rel="stylesheet"');
    expect(stylePos).toBeGreaterThanOrEqual(0);
    expect(linkPos).toBeGreaterThanOrEqual(0);
    expect(linkPos).toBeGreaterThan(stylePos);
  });

  test("inline <style> contains fallback selectors but NOT full framework rules", () => {
    const doc = wrapDocument({ body: "<p>hi</p>", meta: makeMeta(), theme: defaultTheme() });
    const styleMatch = /<style>([\s\S]*?)<\/style>/i.exec(doc);
    expect(styleMatch).not.toBeNull();
    const styleContent = styleMatch?.[1] ?? "";
    // Fallback selectors present
    expect(styleContent).toContain(".card");
    expect(styleContent).toContain(".callout");
    expect(styleContent).toContain(":root");
    // Full framework rules NOT in inline style (they live in /theme.css)
    expect(styleContent).not.toContain(".h-section");
    expect(styleContent).not.toContain(".eyebrow");
    expect(styleContent).not.toContain(".tldr\n");
  });

  test("empty string themeCssHref uses the default ../../../theme.css", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      themeCssHref: "",
    });
    expect(doc).toContain('<link rel="stylesheet" href="../../../theme.css">');
  });

  // ─── Favicon link tests ────────────────────────────────────────────────────

  test("default themeCssHref produces favicon link to ../../../favicon.svg", () => {
    const doc = wrapDocument({ body: "<p>hi</p>", meta: makeMeta(), theme: defaultTheme() });
    expect(doc).toContain('<link rel="icon" type="image/svg+xml" href="../../../favicon.svg">');
  });

  test("custom themeCssHref derives matching favicon path", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      themeCssHref: "theme.css",
    });
    expect(doc).toContain('<link rel="icon" type="image/svg+xml" href="favicon.svg">');
  });

  test("themeCssHref: null suppresses the favicon link too", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      themeCssHref: null,
    });
    expect(doc).not.toContain('<link rel="icon"');
  });
});

// ─── Interactive rendering ─────────────────────────────────────────────────────

function makeInteractive(overrides?: Partial<InteractiveData>): InteractiveData {
  return {
    status: "open",
    requireAll: true,
    expiresAt: "2026-12-31T23:59:59Z",
    questions: [
      {
        type: "pick_one",
        id: "q1",
        question: "Which option?",
        options: [
          { id: "a", label: "Option A" },
          { id: "b", label: "Option B" },
        ],
      },
      {
        type: "confirm",
        id: "q2",
        question: "Are you sure?",
        yesLabel: "Absolutely",
        noLabel: "No way",
      },
    ],
    answers: {},
    ...overrides,
  };
}

describe("wrapDocument — interactive absent", () => {
  test("output is identical to non-interactive when interactive not provided", () => {
    const docWithout = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      themeCssHref: null,
    });
    // Omitting interactive entirely is equivalent to not having it
    const optsWithoutInteractive: Parameters<typeof wrapDocument>[0] = {
      body: "<p>hi</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      themeCssHref: null,
    };
    const docOmitted = wrapDocument(optsWithoutInteractive);
    expect(docWithout).toBe(docOmitted);
  });

  test("does not contain cs-questions when interactive absent", () => {
    const doc = wrapDocument({
      body: "<p>body</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
    });
    // Extract the <body> content (exclude <style> which now contains cs-* selectors)
    const bodyMatch = /<body>([\s\S]*?)<\/body>/.exec(doc);
    const bodyContent = bodyMatch?.[1] ?? "";
    expect(bodyContent).not.toContain("cs-questions");
    expect(bodyContent).not.toContain("cs-control-");
    expect(bodyContent).not.toContain("cs-answered");
  });

  test("cesium-meta JSON does not contain interactive key when absent", () => {
    const doc = wrapDocument({ body: "<p>hi</p>", meta: makeMeta(), theme: defaultTheme() });
    const match = /<script type="application\/json" id="cesium-meta">([\s\S]*?)<\/script>/i.exec(
      doc,
    );
    expect(match).not.toBeNull();
    const parsed = JSON.parse(unwrap(unwrap(match, "meta match")[1], "meta json")) as Record<
      string,
      unknown
    >;
    expect("interactive" in parsed).toBe(false);
  });
});

describe("wrapDocument — interactive with 2 unanswered questions", () => {
  test("contains cs-questions section", () => {
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive(),
    });
    expect(doc).toContain('<section class="cs-questions">');
  });

  test("contains 2 cs-control-* sections", () => {
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive(),
    });
    const controlMatches = doc.match(/class="cs-control-/g);
    expect(controlMatches).not.toBeNull();
    expect(unwrap(controlMatches, "control matches").length).toBe(2);
  });

  test("each control section has correct data-question-id", () => {
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive(),
    });
    expect(doc).toContain('data-question-id="q1"');
    expect(doc).toContain('data-question-id="q2"');
  });

  test("control sections contain QUESTION eyebrow and question text", () => {
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive(),
    });
    expect(doc).toContain("QUESTION");
    expect(doc).toContain("Which option?");
    expect(doc).toContain("Are you sure?");
  });

  test("no cs-answered sections when nothing answered", () => {
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive(),
    });
    // Narrow check to body — <style> contains cs-answered selector but body should not
    const bodyMatch = /<body>([\s\S]*?)<\/body>/.exec(doc);
    const bodyContent = bodyMatch?.[1] ?? "";
    expect(bodyContent).not.toContain("cs-answered");
  });

  test("body framing content appears before cs-questions", () => {
    const doc = wrapDocument({
      body: "<p>framing prose</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive(),
    });
    const bodyPos = doc.indexOf("framing prose");
    const questionsPos = doc.indexOf('<section class="cs-questions">');
    expect(bodyPos).toBeGreaterThanOrEqual(0);
    expect(questionsPos).toBeGreaterThanOrEqual(0);
    expect(bodyPos).toBeLessThan(questionsPos);
  });
});

describe("wrapDocument — interactive with 1 of 2 answered", () => {
  test("contains 1 cs-control-* and 1 cs-answered", () => {
    const interactive = makeInteractive({
      answers: {
        q1: {
          value: { type: "pick_one", selected: "a" },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    });
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    const controlCount = (doc.match(/class="cs-control-/g) ?? []).length;
    const answeredCount = (doc.match(/class="cs-answered"/g) ?? []).length;
    expect(controlCount).toBe(1);
    expect(answeredCount).toBe(1);
  });

  test("answered section shows YOU ANSWERED eyebrow", () => {
    const interactive = makeInteractive({
      answers: {
        q1: {
          value: { type: "pick_one", selected: "a" },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    });
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    expect(doc).toContain("YOU ANSWERED");
  });

  test("pick_one answered shows option label", () => {
    const interactive = makeInteractive({
      answers: {
        q1: {
          value: { type: "pick_one", selected: "b" },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    });
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    expect(doc).toContain("Option B");
  });

  test("confirm answered shows yesLabel", () => {
    const interactive = makeInteractive({
      answers: {
        q2: {
          value: { type: "confirm", choice: "yes" },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    });
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    // renderAnswered for confirm renders a button with the chosen label
    expect(doc).toContain("Absolutely");
  });

  test("confirm answered shows noLabel", () => {
    const interactive = makeInteractive({
      answers: {
        q2: {
          value: { type: "confirm", choice: "no" },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    });
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    expect(doc).toContain("No way");
  });
});

describe("wrapDocument — interactive cesium-meta JSON", () => {
  test("cesium-meta JSON contains full interactive object", () => {
    const interactive = makeInteractive();
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    const match = /<script type="application\/json" id="cesium-meta">([\s\S]*?)<\/script>/i.exec(
      doc,
    );
    expect(match).not.toBeNull();
    const parsed = JSON.parse(unwrap(unwrap(match, "meta match")[1], "meta json")) as Record<
      string,
      unknown
    >;
    expect(parsed["interactive"]).toBeDefined();
    const embeddedInteractive = parsed["interactive"] as Record<string, unknown>;
    expect(embeddedInteractive["status"]).toBe("open");
    expect(embeddedInteractive["requireAll"]).toBe(true);
    expect(embeddedInteractive["questions"]).toHaveLength(2);
  });

  test("cesium-meta interactive questions are full objects", () => {
    const interactive = makeInteractive();
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    const match = /<script type="application\/json" id="cesium-meta">([\s\S]*?)<\/script>/i.exec(
      doc,
    );
    const parsed = JSON.parse(unwrap(unwrap(match, "meta match")[1], "meta json")) as Record<
      string,
      unknown
    >;
    const questions = (parsed["interactive"] as Record<string, unknown>)["questions"] as Record<
      string,
      unknown
    >[];
    expect(questions[0]?.["id"]).toBe("q1");
    expect(questions[1]?.["id"]).toBe("q2");
  });
});

describe("wrapDocument — interactive HTML escaping", () => {
  test("question text with HTML special chars is escaped in control section", () => {
    const interactive: InteractiveData = {
      status: "open",
      requireAll: true,
      expiresAt: "2026-12-31T23:59:59Z",
      questions: [
        {
          type: "ask_text",
          id: "q-xss",
          question: '<script>alert("xss")</script>',
        },
      ],
      answers: {},
    };
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    expect(doc).not.toContain('<script>alert("xss")</script>');
    expect(doc).toContain("&lt;script&gt;");
  });

  test("ask_text answer text is HTML-escaped in rendered section", () => {
    const interactive: InteractiveData = {
      status: "open",
      requireAll: true,
      expiresAt: "2026-12-31T23:59:59Z",
      questions: [{ type: "ask_text", id: "qt", question: "Type something" }],
      answers: {
        qt: {
          value: { type: "ask_text", text: "<b>bold</b> & more" },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    };
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    // The cs-answered section must use escaped HTML
    const answeredMatch = /<section class="cs-answered"[^>]*>([\s\S]*?)<\/section>/.exec(doc);
    expect(answeredMatch).not.toBeNull();
    const sectionHtml = unwrap(unwrap(answeredMatch, "answered match")[1], "answered section html");
    expect(sectionHtml).not.toContain("<b>bold</b>");
    expect(sectionHtml).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });

  test("ask_text multiline answer uses <br> for newlines", () => {
    const interactive: InteractiveData = {
      status: "open",
      requireAll: true,
      expiresAt: "2026-12-31T23:59:59Z",
      questions: [{ type: "ask_text", id: "qt", question: "Type something" }],
      answers: {
        qt: {
          value: { type: "ask_text", text: "line one\nline two" },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    };
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    expect(doc).toContain("line one<br>line two");
  });
});

describe("wrapDocument — interactive answer value rendering", () => {
  test("pick_many shows comma-joined labels", () => {
    const interactive: InteractiveData = {
      status: "open",
      requireAll: true,
      expiresAt: "2026-12-31T23:59:59Z",
      questions: [
        {
          type: "pick_many",
          id: "pm",
          question: "Pick some",
          options: [
            { id: "x", label: "X-Ray" },
            { id: "y", label: "Yankee" },
            { id: "z", label: "Zulu" },
          ],
        },
      ],
      answers: {
        pm: {
          value: { type: "pick_many", selected: ["x", "z"] },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    };
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    // renderAnswered for pick_many renders each selected item as a .cs-pick-final block
    expect(doc).toContain("X-Ray");
    expect(doc).toContain("Zulu");
  });

  test("slider shows value", () => {
    const interactive: InteractiveData = {
      status: "open",
      requireAll: true,
      expiresAt: "2026-12-31T23:59:59Z",
      questions: [{ type: "slider", id: "sl", question: "Rate it", min: 0, max: 10 }],
      answers: {
        sl: {
          value: { type: "slider", value: 8 },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    };
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    // renderAnswered for slider renders cs-slider-final with the value in <strong>
    expect(doc).toContain("cs-slider-final");
    expect(doc).toContain("<strong>8</strong>");
  });

  test("react shows decision", () => {
    const interactive: InteractiveData = {
      status: "open",
      requireAll: true,
      expiresAt: "2026-12-31T23:59:59Z",
      questions: [{ type: "react", id: "rt", question: "Approve?" }],
      answers: {
        rt: {
          value: { type: "react", decision: "approve" },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    };
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    // renderAnswered for react renders the decision as a disabled button
    expect(doc).toContain("approve");
  });

  test("react with comment shows both decision and comment", () => {
    const interactive: InteractiveData = {
      status: "open",
      requireAll: true,
      expiresAt: "2026-12-31T23:59:59Z",
      questions: [{ type: "react", id: "rt", question: "Approve?", allowComment: true }],
      answers: {
        rt: {
          value: { type: "react", decision: "approve", comment: "Looks great" },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    };
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    expect(doc).toContain("approve");
    expect(doc).toContain("Looks great");
  });

  test("confirm with default labels falls back to Yes/No", () => {
    const interactive: InteractiveData = {
      status: "open",
      requireAll: true,
      expiresAt: "2026-12-31T23:59:59Z",
      questions: [{ type: "confirm", id: "cf", question: "Continue?" }],
      answers: {
        cf: {
          value: { type: "confirm", choice: "yes" },
          answeredAt: "2026-05-11T15:00:00Z",
        },
      },
    };
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive,
    });
    expect(doc).toContain(">Yes<");
  });
});

describe("wrapDocument — ask kind footer", () => {
  test("footer renders ask as the kind", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
    });
    expect(doc).toContain("kind: ask");
  });
});

// ─── Phase B: client JS injection ─────────────────────────────────────────────

describe("wrapDocument — client JS injection", () => {
  test("includes <script data-cesium-client> with client JS when status is open", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive({ status: "open" }),
      themeCssHref: null,
    });
    expect(doc).toContain("<script data-cesium-client>");
    expect(doc).toContain("DOMContentLoaded");
  });

  test("data-cesium-client attribute is present on script tag (not plain <script>)", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive({ status: "open" }),
      themeCssHref: null,
    });
    // Must have the attribute
    expect(doc).toContain("data-cesium-client");
  });

  test("client JS appears AFTER cs-questions and BEFORE footer", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive({ status: "open" }),
      themeCssHref: null,
    });
    const questionsPos = doc.indexOf("cs-questions");
    const scriptPos = doc.indexOf("DOMContentLoaded");
    const footerPos = doc.indexOf('class="byline"');
    expect(questionsPos).toBeGreaterThanOrEqual(0);
    expect(scriptPos).toBeGreaterThan(questionsPos);
    expect(footerPos).toBeGreaterThan(scriptPos);
  });

  test("NO client <script> when status is complete", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive({ status: "complete" }),
      themeCssHref: null,
    });
    expect(doc).not.toContain("DOMContentLoaded");
    expect(doc).not.toContain("data-cesium-client");
  });

  test("NO client <script> when status is expired", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive({ status: "expired" }),
      themeCssHref: null,
    });
    expect(doc).not.toContain("DOMContentLoaded");
    expect(doc).not.toContain("data-cesium-client");
  });

  test("NO client <script> when status is cancelled", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive({ status: "cancelled" }),
      themeCssHref: null,
    });
    expect(doc).not.toContain("DOMContentLoaded");
    expect(doc).not.toContain("data-cesium-client");
  });

  test("NO client <script> when no interactive", () => {
    const doc = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      themeCssHref: null,
    });
    expect(doc).not.toContain("DOMContentLoaded");
    expect(doc).not.toContain("data-cesium-client");
  });
});

// ─── Phase B: real control HTML in document ────────────────────────────────────

describe("wrapDocument — Phase B control HTML", () => {
  test("pick_one control renders buttons with cs-pick class", () => {
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive(),
      themeCssHref: null,
    });
    expect(doc).toContain('class="cs-pick"');
  });

  test("pick_one options rendered as buttons with data-value", () => {
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive(),
      themeCssHref: null,
    });
    expect(doc).toContain('data-value="a"');
    expect(doc).toContain('data-value="b"');
  });

  test("confirm control renders yes/no buttons", () => {
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive(),
      themeCssHref: null,
    });
    expect(doc).toContain('class="cs-confirm cs-yes"');
    expect(doc).toContain('class="cs-confirm cs-no"');
  });

  test("no more Phase A placeholder text", () => {
    const doc = wrapDocument({
      body: "<p>framing</p>",
      meta: makeMeta({ kind: "ask" }),
      theme: defaultTheme(),
      interactive: makeInteractive(),
      themeCssHref: null,
    });
    expect(doc).not.toContain("(control rendering — Phase B)");
  });
});

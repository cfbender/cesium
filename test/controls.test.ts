import { describe, expect, test } from "bun:test";
import { renderControl, renderAnswered } from "../src/render/controls.ts";
import type { Question, AnswerValue } from "../src/render/validate.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePickOne(
  overrides?: Partial<Extract<Question, { type: "pick_one" }>>,
): Extract<Question, { type: "pick_one" }> {
  return {
    type: "pick_one",
    id: "q1",
    question: "Which framework?",
    options: [
      { id: "react", label: "React", description: "Facebook's library" },
      { id: "vue", label: "Vue" },
      { id: "svelte", label: "Svelte" },
    ],
    ...overrides,
  };
}

function makePickMany(
  overrides?: Partial<Extract<Question, { type: "pick_many" }>>,
): Extract<Question, { type: "pick_many" }> {
  return {
    type: "pick_many",
    id: "q2",
    question: "Which tools?",
    options: [
      { id: "ts", label: "TypeScript" },
      { id: "lint", label: "Linting" },
      { id: "fmt", label: "Formatting" },
    ],
    ...overrides,
  };
}

function makeConfirm(
  overrides?: Partial<Extract<Question, { type: "confirm" }>>,
): Extract<Question, { type: "confirm" }> {
  return {
    type: "confirm",
    id: "q3",
    question: "Are you sure?",
    ...overrides,
  };
}

function makeAskText(
  overrides?: Partial<Extract<Question, { type: "ask_text" }>>,
): Extract<Question, { type: "ask_text" }> {
  return {
    type: "ask_text",
    id: "q4",
    question: "Describe your approach",
    ...overrides,
  };
}

function makeSlider(
  overrides?: Partial<Extract<Question, { type: "slider" }>>,
): Extract<Question, { type: "slider" }> {
  return {
    type: "slider",
    id: "q5",
    question: "Rate this",
    min: 0,
    max: 10,
    ...overrides,
  };
}

function makeReact(
  overrides?: Partial<Extract<Question, { type: "react" }>>,
): Extract<Question, { type: "react" }> {
  return {
    type: "react",
    id: "q6",
    question: "Do you approve?",
    ...overrides,
  };
}

// ─── renderControl — pick_one ─────────────────────────────────────────────────

describe("renderControl — pick_one", () => {
  test("wraps in <section class='cs-control-pick_one' data-question-id>", () => {
    const html = renderControl(makePickOne({ id: "myid" }));
    expect(html).toContain('class="cs-control-pick_one"');
    expect(html).toContain('data-question-id="myid"');
  });

  test("contains QUESTION eyebrow", () => {
    const html = renderControl(makePickOne());
    expect(html).toContain("QUESTION");
  });

  test("contains question text in h3.h-section", () => {
    const html = renderControl(makePickOne());
    expect(html).toContain('<h3 class="h-section">Which framework?</h3>');
  });

  test("renders each option as <button class='cs-pick' data-value>", () => {
    const html = renderControl(makePickOne());
    expect(html).toContain('<button class="cs-pick" data-value="react">');
    expect(html).toContain('<button class="cs-pick" data-value="vue">');
    expect(html).toContain('<button class="cs-pick" data-value="svelte">');
  });

  test("option label rendered in <strong>", () => {
    const html = renderControl(makePickOne());
    expect(html).toContain("<strong>React</strong>");
    expect(html).toContain("<strong>Vue</strong>");
  });

  test("option description rendered in .cs-pick-desc", () => {
    const html = renderControl(makePickOne());
    expect(html).toContain('class="cs-pick-desc"');
    expect(html).toContain("Facebook's library");
  });

  test("recommended option gets cs-recommended class", () => {
    const html = renderControl(makePickOne({ recommended: "vue" }));
    expect(html).toContain('class="cs-pick cs-recommended" data-value="vue"');
  });

  test("recommended option includes RECOMMENDED chip", () => {
    const html = renderControl(makePickOne({ recommended: "svelte" }));
    expect(html).toContain("RECOMMENDED");
  });

  test("non-recommended option does NOT get cs-recommended", () => {
    const html = renderControl(makePickOne({ recommended: "vue" }));
    // react and svelte should not have cs-recommended
    expect(html).not.toContain('class="cs-pick cs-recommended" data-value="react"');
    expect(html).not.toContain('class="cs-pick cs-recommended" data-value="svelte"');
  });

  test("HTML-escapes question text", () => {
    const html = renderControl(makePickOne({ question: '<b>bold</b> & "quoted"' }));
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
  });

  test("context appears in eyebrow when provided", () => {
    const html = renderControl(makePickOne({ context: "Choose carefully" }));
    expect(html).toContain("Choose carefully");
  });
});

// ─── renderControl — pick_many ────────────────────────────────────────────────

describe("renderControl — pick_many", () => {
  test("wraps in <section class='cs-control-pick_many' data-question-id>", () => {
    const html = renderControl(makePickMany({ id: "pm1" }));
    expect(html).toContain('class="cs-control-pick_many"');
    expect(html).toContain('data-question-id="pm1"');
  });

  test("renders each option as <label class='cs-pick'>", () => {
    const html = renderControl(makePickMany());
    expect(html).toContain('<label class="cs-pick">');
  });

  test("each option has <input type='checkbox' data-value>", () => {
    const html = renderControl(makePickMany());
    expect(html).toContain('<input type="checkbox" data-value="ts">');
    expect(html).toContain('<input type="checkbox" data-value="lint">');
    expect(html).toContain('<input type="checkbox" data-value="fmt">');
  });

  test("submit button is present and initially disabled", () => {
    const html = renderControl(makePickMany());
    expect(html).toContain('<button class="cs-submit" disabled>Submit</button>');
  });

  test("shows min hint when min is set", () => {
    const html = renderControl(makePickMany({ min: 2 }));
    expect(html).toContain("at least 2");
  });

  test("shows max hint when max is set", () => {
    const html = renderControl(makePickMany({ max: 3 }));
    expect(html).toContain("at most 3");
  });

  test("shows both min and max hint", () => {
    const html = renderControl(makePickMany({ min: 1, max: 3 }));
    expect(html).toContain("at least 1");
    expect(html).toContain("at most 3");
  });

  test("no hint when neither min nor max set", () => {
    const html = renderControl(makePickMany());
    expect(html).not.toContain("at least");
    expect(html).not.toContain("at most");
  });
});

// ─── renderControl — confirm ──────────────────────────────────────────────────

describe("renderControl — confirm", () => {
  test("wraps in <section class='cs-control-confirm' data-question-id>", () => {
    const html = renderControl(makeConfirm({ id: "cf1" }));
    expect(html).toContain('class="cs-control-confirm"');
    expect(html).toContain('data-question-id="cf1"');
  });

  test("renders yes button with data-value='yes'", () => {
    const html = renderControl(makeConfirm());
    expect(html).toContain('class="cs-confirm cs-yes" data-value="yes"');
  });

  test("renders no button with data-value='no'", () => {
    const html = renderControl(makeConfirm());
    expect(html).toContain('class="cs-confirm cs-no" data-value="no"');
  });

  test("default labels are Yes and No", () => {
    const html = renderControl(makeConfirm());
    expect(html).toContain(">Yes<");
    expect(html).toContain(">No<");
  });

  test("custom yesLabel is used", () => {
    const html = renderControl(makeConfirm({ yesLabel: "Absolutely" }));
    expect(html).toContain(">Absolutely<");
    expect(html).not.toContain(">Yes<");
  });

  test("custom noLabel is used", () => {
    const html = renderControl(makeConfirm({ noLabel: "Never" }));
    expect(html).toContain(">Never<");
    expect(html).not.toContain(">No<");
  });
});

// ─── renderControl — ask_text ─────────────────────────────────────────────────

describe("renderControl — ask_text", () => {
  test("wraps in <section class='cs-control-ask_text' data-question-id>", () => {
    const html = renderControl(makeAskText({ id: "at1" }));
    expect(html).toContain('class="cs-control-ask_text"');
    expect(html).toContain('data-question-id="at1"');
  });

  test("renders <input type='text'> for single-line (default)", () => {
    const html = renderControl(makeAskText());
    expect(html).toContain('<input type="text" class="cs-text"');
    expect(html).not.toContain("<textarea");
  });

  test("renders <textarea> for multiline=true", () => {
    const html = renderControl(makeAskText({ multiline: true }));
    expect(html).toContain('<textarea class="cs-text"');
    expect(html).not.toContain('<input type="text"');
  });

  test("textarea has rows=4", () => {
    const html = renderControl(makeAskText({ multiline: true }));
    expect(html).toContain('rows="4"');
  });

  test("submit button present and disabled", () => {
    const html = renderControl(makeAskText());
    expect(html).toContain('<button class="cs-submit" disabled>Submit</button>');
  });

  test("placeholder attribute set when provided", () => {
    const html = renderControl(makeAskText({ placeholder: "Type here..." }));
    expect(html).toContain('placeholder="Type here..."');
  });

  test("empty placeholder when not provided", () => {
    const html = renderControl(makeAskText());
    expect(html).toContain('placeholder=""');
  });

  test("optional=true renders cs-skip button", () => {
    const html = renderControl(makeAskText({ optional: true }));
    expect(html).toContain('class="cs-skip"');
  });

  test("optional=true wraps buttons in cs-button-row", () => {
    const html = renderControl(makeAskText({ optional: true }));
    expect(html).toContain('class="cs-button-row"');
  });

  test("optional=false (explicit) does NOT render skip button", () => {
    const html = renderControl(makeAskText({ optional: false }));
    expect(html).not.toContain("cs-skip");
    expect(html).not.toContain("cs-button-row");
  });

  test("optional absent does NOT render skip button", () => {
    const html = renderControl(makeAskText());
    expect(html).not.toContain("cs-skip");
    expect(html).not.toContain("cs-button-row");
  });

  test("optional=true skip button has data-question-id", () => {
    const html = renderControl(makeAskText({ id: "myq", optional: true }));
    expect(html).toContain('data-question-id="myq"');
  });

  test("optional=true: question text is properly HTML-escaped", () => {
    const html = renderControl(makeAskText({ optional: true, question: "<b>Anything</b> else?" }));
    expect(html).not.toContain("<b>Anything</b>");
    expect(html).toContain("&lt;b&gt;Anything&lt;/b&gt;");
  });
});

// ─── renderControl — slider ───────────────────────────────────────────────────

describe("renderControl — slider", () => {
  test("wraps in <section class='cs-control-slider' data-question-id>", () => {
    const html = renderControl(makeSlider({ id: "sl1" }));
    expect(html).toContain('class="cs-control-slider"');
    expect(html).toContain('data-question-id="sl1"');
  });

  test("renders <input type='range' class='cs-slider'>", () => {
    const html = renderControl(makeSlider());
    expect(html).toContain('<input type="range" class="cs-slider"');
  });

  test("min and max attributes set", () => {
    const html = renderControl(makeSlider({ min: 5, max: 95 }));
    expect(html).toContain('min="5"');
    expect(html).toContain('max="95"');
  });

  test("step defaults to 1", () => {
    const html = renderControl(makeSlider());
    expect(html).toContain('step="1"');
  });

  test("step uses provided value", () => {
    const html = renderControl(makeSlider({ step: 5 }));
    expect(html).toContain('step="5"');
  });

  test("value defaults to min when defaultValue not set", () => {
    const html = renderControl(makeSlider({ min: 3, max: 10 }));
    expect(html).toContain('value="3"');
  });

  test("value uses defaultValue when set", () => {
    const html = renderControl(makeSlider({ min: 0, max: 10, defaultValue: 7 }));
    expect(html).toContain('value="7"');
  });

  test("renders <output class='cs-slider-out'> with defaultValue", () => {
    const html = renderControl(makeSlider({ min: 0, max: 10, defaultValue: 4 }));
    expect(html).toContain('<output class="cs-slider-out">4</output>');
  });

  test("submit button present (always enabled for slider)", () => {
    const html = renderControl(makeSlider());
    expect(html).toContain('<button class="cs-submit">Submit</button>');
    expect(html).not.toContain("disabled");
  });
});

// ─── renderControl — react ────────────────────────────────────────────────────

describe("renderControl — react", () => {
  test("wraps in <section class='cs-control-react' data-question-id>", () => {
    const html = renderControl(makeReact({ id: "rc1" }));
    expect(html).toContain('class="cs-control-react"');
    expect(html).toContain('data-question-id="rc1"');
  });

  test("approve mode (default) renders Approve/Reject/Just a comment buttons", () => {
    const html = renderControl(makeReact());
    expect(html).toContain('data-value="approve"');
    expect(html).toContain('data-value="reject"');
    expect(html).toContain('data-value="comment"');
  });

  test("thumbs mode renders Thumbs up/down buttons", () => {
    const html = renderControl(makeReact({ mode: "thumbs" }));
    expect(html).toContain('data-value="up"');
    expect(html).toContain('data-value="down"');
    expect(html).toContain("Thumbs up");
    expect(html).toContain("Thumbs down");
  });

  test("thumbs mode does NOT render approve/reject/comment", () => {
    const html = renderControl(makeReact({ mode: "thumbs" }));
    expect(html).not.toContain('data-value="approve"');
    expect(html).not.toContain('data-value="reject"');
    expect(html).not.toContain('data-value="comment"');
  });

  test("allowComment=true adds textarea.cs-react-comment", () => {
    const html = renderControl(makeReact({ allowComment: true }));
    expect(html).toContain('<textarea class="cs-react-comment"');
    expect(html).toContain('placeholder="Optional comment..."');
  });

  test("allowComment=false does NOT add textarea", () => {
    const html = renderControl(makeReact({ allowComment: false }));
    expect(html).not.toContain("<textarea");
  });

  test("no allowComment by default means no textarea", () => {
    const html = renderControl(makeReact());
    expect(html).not.toContain("<textarea");
  });

  test("buttons have class cs-react", () => {
    const html = renderControl(makeReact());
    expect(html).toContain('class="cs-react"');
  });
});

// ─── renderAnswered — pick_one ────────────────────────────────────────────────

describe("renderAnswered — pick_one", () => {
  test("wraps in <section class='cs-answered' data-question-id>", () => {
    const q = makePickOne({ id: "qa1" });
    const a: AnswerValue = { type: "pick_one", selected: "react" };
    const html = renderAnswered(q, a);
    expect(html).toContain('class="cs-answered"');
    expect(html).toContain('data-question-id="qa1"');
  });

  test("shows YOU ANSWERED eyebrow", () => {
    const html = renderAnswered(makePickOne(), { type: "pick_one", selected: "react" });
    expect(html).toContain("YOU ANSWERED");
  });

  test("renders chosen option label in .cs-pick-final", () => {
    const html = renderAnswered(makePickOne(), { type: "pick_one", selected: "vue" });
    expect(html).toContain('class="cs-pick cs-pick-final"');
    expect(html).toContain("<strong>Vue</strong>");
  });

  test("renders option description when present", () => {
    const html = renderAnswered(makePickOne(), { type: "pick_one", selected: "react" });
    expect(html).toContain("cs-pick-desc");
    expect(html).toContain("Facebook's library");
  });

  test("falls back to raw id when option not found", () => {
    const html = renderAnswered(makePickOne(), { type: "pick_one", selected: "unknown-id" });
    expect(html).toContain("unknown-id");
  });
});

// ─── renderAnswered — pick_many ───────────────────────────────────────────────

describe("renderAnswered — pick_many", () => {
  test("wraps in <section class='cs-answered' data-question-id>", () => {
    const q = makePickMany({ id: "qm1" });
    const a: AnswerValue = { type: "pick_many", selected: ["ts"] };
    const html = renderAnswered(q, a);
    expect(html).toContain('class="cs-answered"');
    expect(html).toContain('data-question-id="qm1"');
  });

  test("renders each selected option as .cs-pick-final", () => {
    const html = renderAnswered(makePickMany(), {
      type: "pick_many",
      selected: ["ts", "fmt"],
    });
    expect(html).toContain("<strong>TypeScript</strong>");
    expect(html).toContain("<strong>Formatting</strong>");
  });

  test("does not render unselected options", () => {
    const html = renderAnswered(makePickMany(), {
      type: "pick_many",
      selected: ["ts"],
    });
    expect(html).not.toContain("<strong>Linting</strong>");
    expect(html).not.toContain("<strong>Formatting</strong>");
  });

  test("shows YOU ANSWERED eyebrow", () => {
    const html = renderAnswered(makePickMany(), { type: "pick_many", selected: ["ts"] });
    expect(html).toContain("YOU ANSWERED");
  });
});

// ─── renderAnswered — confirm ─────────────────────────────────────────────────

describe("renderAnswered — confirm", () => {
  test("wraps in <section class='cs-answered' data-question-id>", () => {
    const html = renderAnswered(makeConfirm({ id: "qc1" }), { type: "confirm", choice: "yes" });
    expect(html).toContain('class="cs-answered"');
    expect(html).toContain('data-question-id="qc1"');
  });

  test("chosen=yes: yes button has cs-confirm-final", () => {
    const html = renderAnswered(makeConfirm(), { type: "confirm", choice: "yes" });
    expect(html).toContain("cs-confirm-final");
    expect(html).toContain("cs-yes");
  });

  test("chosen=no: no button has cs-confirm-final", () => {
    const html = renderAnswered(makeConfirm(), { type: "confirm", choice: "no" });
    expect(html).toContain("cs-confirm-final");
    expect(html).toContain("cs-no");
  });

  test("default labels Yes/No shown", () => {
    const html = renderAnswered(makeConfirm(), { type: "confirm", choice: "yes" });
    expect(html).toContain("Yes");
    expect(html).toContain("No");
  });

  test("custom labels used", () => {
    const html = renderAnswered(makeConfirm({ yesLabel: "Approve", noLabel: "Reject" }), {
      type: "confirm",
      choice: "no",
    });
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
  });
});

// ─── renderAnswered — ask_text ────────────────────────────────────────────────

describe("renderAnswered — ask_text", () => {
  test("wraps in <section class='cs-answered' data-question-id>", () => {
    const html = renderAnswered(makeAskText({ id: "qt1" }), { type: "ask_text", text: "hello" });
    expect(html).toContain('class="cs-answered"');
    expect(html).toContain('data-question-id="qt1"');
  });

  test("renders answer in <blockquote class='cs-answered-text'>", () => {
    const html = renderAnswered(makeAskText(), { type: "ask_text", text: "My answer" });
    expect(html).toContain('<blockquote class="cs-answered-text">My answer</blockquote>');
  });

  test("HTML-escapes answer text", () => {
    const html = renderAnswered(makeAskText(), { type: "ask_text", text: "<script>xss</script>" });
    expect(html).not.toContain("<script>xss</script>");
    expect(html).toContain("&lt;script&gt;xss&lt;/script&gt;");
  });

  test("newlines converted to <br>", () => {
    const html = renderAnswered(makeAskText(), { type: "ask_text", text: "line1\nline2" });
    expect(html).toContain("line1<br>line2");
  });

  test("empty text with optional=true renders cs-answered-skipped", () => {
    const html = renderAnswered(makeAskText({ optional: true }), { type: "ask_text", text: "" });
    expect(html).toContain('class="cs-answered-skipped"');
    expect(html).toContain("(skipped)");
    expect(html).not.toContain("cs-answered-text");
  });

  test("empty text with optional=false renders blockquote (not skipped)", () => {
    const html = renderAnswered(makeAskText({ optional: false }), { type: "ask_text", text: "" });
    expect(html).toContain('class="cs-answered-text"');
    expect(html).not.toContain("cs-answered-skipped");
  });

  test("non-empty text with optional=true still renders blockquote (regression)", () => {
    const html = renderAnswered(makeAskText({ optional: true }), {
      type: "ask_text",
      text: "Some text",
    });
    expect(html).toContain('<blockquote class="cs-answered-text">Some text</blockquote>');
    expect(html).not.toContain("cs-answered-skipped");
  });
});

// ─── renderAnswered — slider ──────────────────────────────────────────────────

describe("renderAnswered — slider", () => {
  test("wraps in <section class='cs-answered' data-question-id>", () => {
    const html = renderAnswered(makeSlider({ id: "qs1" }), { type: "slider", value: 7 });
    expect(html).toContain('class="cs-answered"');
    expect(html).toContain('data-question-id="qs1"');
  });

  test("renders <p class='cs-slider-final'> with value", () => {
    const html = renderAnswered(makeSlider(), { type: "slider", value: 8 });
    expect(html).toContain('class="cs-slider-final"');
    expect(html).toContain("<strong>8</strong>");
  });
});

// ─── renderAnswered — react ───────────────────────────────────────────────────

describe("renderAnswered — react", () => {
  test("wraps in <section class='cs-answered' data-question-id>", () => {
    const html = renderAnswered(makeReact({ id: "qr1" }), {
      type: "react",
      decision: "approve",
    });
    expect(html).toContain('class="cs-answered"');
    expect(html).toContain('data-question-id="qr1"');
  });

  test("renders decision in disabled button with cs-confirm-final", () => {
    const html = renderAnswered(makeReact(), { type: "react", decision: "approve" });
    expect(html).toContain("cs-confirm-final");
    expect(html).toContain(">approve<");
  });

  test("renders optional comment in .cs-comment", () => {
    const html = renderAnswered(makeReact(), {
      type: "react",
      decision: "reject",
      comment: "Needs more work",
    });
    expect(html).toContain('class="cs-comment"');
    expect(html).toContain("Needs more work");
  });

  test("no comment element when comment is absent", () => {
    const html = renderAnswered(makeReact(), { type: "react", decision: "approve" });
    expect(html).not.toContain("cs-comment");
  });

  test("HTML-escapes decision and comment", () => {
    const html = renderAnswered(makeReact(), {
      type: "react",
      decision: "<b>yes</b>",
      comment: "<script>bad</script>",
    });
    expect(html).not.toContain("<b>yes</b>");
    expect(html).not.toContain("<script>bad</script>");
    expect(html).toContain("&lt;b&gt;yes&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
  });
});

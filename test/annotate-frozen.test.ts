import { describe, expect, test } from "bun:test";
import {
  renderFrozenBubble,
  renderFrozenRail,
  renderVerdictPill,
} from "../src/render/annotate-frozen.ts";
import type { Comment } from "../src/render/validate.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeComment(overrides?: Partial<Comment>): Comment {
  return {
    id: "abc123",
    anchor: "block-1",
    selectedText: "",
    comment: "Test comment",
    createdAt: "2026-05-13T12:00:00Z",
    ...overrides,
  };
}

// ─── renderFrozenBubble ───────────────────────────────────────────────────────

describe("renderFrozenBubble", () => {
  test("produces cs-comment-bubble article with correct attributes", () => {
    const comment = makeComment({ id: "cmt-42", anchor: "block-2" });
    const html = renderFrozenBubble(comment);
    expect(html).toContain('<article class="cs-comment-bubble"');
    expect(html).toContain('data-comment-id="cmt-42"');
    expect(html).toContain('data-anchor="block-2"');
  });

  test("produces cs-comment-anchor-label with humanized anchor (block only)", () => {
    const comment = makeComment({ anchor: "block-5" });
    const html = renderFrozenBubble(comment);
    expect(html).toContain("Block 5");
    expect(html).toContain('class="cs-comment-anchor-label"');
  });

  test("produces cs-comment-anchor-label with humanized anchor (block + line)", () => {
    const comment = makeComment({ anchor: "block-3.line-12" });
    const html = renderFrozenBubble(comment);
    expect(html).toContain("Block 3");
    expect(html).toContain("line 12");
    expect(html).toContain("\u00b7");
  });

  test("renders comment text in cs-comment-text paragraph", () => {
    const comment = makeComment({ comment: "Check this out" });
    const html = renderFrozenBubble(comment);
    expect(html).toContain('<p class="cs-comment-text">Check this out</p>');
  });

  test("omits blockquote when selectedText is empty", () => {
    const comment = makeComment({ selectedText: "" });
    const html = renderFrozenBubble(comment);
    expect(html).not.toContain("<blockquote");
  });

  test("omits blockquote when selectedText is whitespace-only", () => {
    const comment = makeComment({ selectedText: "   \n\t  " });
    const html = renderFrozenBubble(comment);
    expect(html).not.toContain("<blockquote");
  });

  test("includes blockquote when selectedText is non-empty", () => {
    const comment = makeComment({ selectedText: "some selected text" });
    const html = renderFrozenBubble(comment);
    expect(html).toContain('<blockquote class="cs-comment-bubble-quote">');
    expect(html).toContain("some selected text");
  });

  test("does NOT include delete button", () => {
    const comment = makeComment();
    const html = renderFrozenBubble(comment);
    expect(html).not.toContain("cs-comment-delete");
    expect(html).not.toContain("<button");
  });

  test("HTML-escapes comment text containing script tag", () => {
    const comment = makeComment({ comment: "<script>alert('xss')</script>" });
    const html = renderFrozenBubble(comment);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("HTML-escapes comment text with ampersand and angle brackets", () => {
    const comment = makeComment({ comment: "foo <b>bar</b> & baz" });
    const html = renderFrozenBubble(comment);
    expect(html).toContain("&lt;b&gt;bar&lt;/b&gt;");
    expect(html).toContain("&amp;");
  });

  test("HTML-escapes selectedText in blockquote", () => {
    const comment = makeComment({ selectedText: "<em>selected</em>" });
    const html = renderFrozenBubble(comment);
    expect(html).not.toContain("<em>");
    expect(html).toContain("&lt;em&gt;");
  });

  test("HTML-escapes comment id and anchor in attributes", () => {
    const comment = makeComment({ id: 'a"b', anchor: "block-1" });
    const html = renderFrozenBubble(comment);
    expect(html).not.toContain('data-comment-id="a"b"');
    expect(html).toContain("&quot;");
  });
});

// ─── renderFrozenRail ─────────────────────────────────────────────────────────

describe("renderFrozenRail", () => {
  test("zero comments returns empty aside with correct attributes", () => {
    const html = renderFrozenRail([]);
    expect(html).toContain('<aside class="cs-comment-rail"');
    expect(html).toContain("data-cesium-comment-rail");
    expect(html).toContain('aria-label="Review comments"');
    expect(html).not.toContain("cs-comment-bubble");
  });

  test("three comments returns three article children", () => {
    const comments = [
      makeComment({ id: "c1", anchor: "block-0" }),
      makeComment({ id: "c2", anchor: "block-1" }),
      makeComment({ id: "c3", anchor: "block-2" }),
    ];
    const html = renderFrozenRail(comments);
    const matches = html.match(/class="cs-comment-bubble"/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(3);
  });

  test("comments appear in order of the input array", () => {
    const comments = [
      makeComment({ id: "first", comment: "First comment" }),
      makeComment({ id: "second", comment: "Second comment" }),
    ];
    const html = renderFrozenRail(comments);
    const firstIdx = html.indexOf("First comment");
    const secondIdx = html.indexOf("Second comment");
    expect(firstIdx).toBeLessThan(secondIdx);
  });
});

// ─── renderVerdictPill ────────────────────────────────────────────────────────

describe("renderVerdictPill", () => {
  test("approve: correct label, CSS class, and data attribute", () => {
    const html = renderVerdictPill({ value: "approve", decidedAt: "2026-05-13T12:00:00Z" });
    expect(html).toContain("Approved");
    expect(html).toContain("cs-verdict-pill-approve");
    expect(html).toContain('data-cesium-verdict="approve"');
  });

  test("request_changes: correct label, CSS class, and data attribute", () => {
    const html = renderVerdictPill({
      value: "request_changes",
      decidedAt: "2026-05-13T12:00:00Z",
    });
    expect(html).toContain("Changes requested");
    expect(html).toContain("cs-verdict-pill-request_changes");
    expect(html).toContain('data-cesium-verdict="request_changes"');
  });

  test("comment: correct label, CSS class, and data attribute", () => {
    const html = renderVerdictPill({ value: "comment", decidedAt: "2026-05-13T12:00:00Z" });
    expect(html).toContain("Reviewed");
    expect(html).toContain("cs-verdict-pill-comment");
    expect(html).toContain('data-cesium-verdict="comment"');
  });

  test("contains eyebrow span with 'Verdict'", () => {
    const html = renderVerdictPill({ value: "approve", decidedAt: "2026-05-13T12:00:00Z" });
    expect(html).toContain('<span class="eyebrow">Verdict</span>');
  });

  test("contains a time element with datetime attribute", () => {
    const html = renderVerdictPill({ value: "approve", decidedAt: "2026-05-13T12:00:00Z" });
    expect(html).toContain('<time datetime="2026-05-13T12:00:00Z"');
  });

  test("formats decidedAt as Month DD, YYYY (fixed date: 2026-05-13T12:00:00Z)", () => {
    // Using noon UTC to avoid any timezone edge case flipping the day
    const html = renderVerdictPill({ value: "approve", decidedAt: "2026-05-13T12:00:00Z" });
    // toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" })
    // → "May 13, 2026"
    expect(html).toContain("May 13, 2026");
  });

  test("does NOT carry data-cesium-anchor (pill is chrome, not content)", () => {
    const html = renderVerdictPill({ value: "approve", decidedAt: "2026-05-13T12:00:00Z" });
    expect(html).not.toContain("data-cesium-anchor");
  });
});

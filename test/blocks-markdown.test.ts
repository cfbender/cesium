// Tests for the owned markdown subset.
// test/blocks-markdown.test.ts

import { describe, test, expect } from "bun:test";
import { renderMarkdown } from "../src/render/blocks/markdown.ts";

// ─── Paragraphs ───────────────────────────────────────────────────────────────

describe("paragraphs", () => {
  test("wraps plain text in <p>", () => {
    expect(renderMarkdown("Hello world.")).toBe("<p>Hello world.</p>");
  });

  test("separates multiple paragraphs with blank lines", () => {
    const result = renderMarkdown("First paragraph.\n\nSecond paragraph.");
    expect(result).toContain("<p>First paragraph.</p>");
    expect(result).toContain("<p>Second paragraph.</p>");
  });

  test("empty string produces empty output", () => {
    expect(renderMarkdown("")).toBe("");
  });
});

// ─── Bold and italic ──────────────────────────────────────────────────────────

describe("bold and italic", () => {
  test("renders **bold** as <strong>", () => {
    const result = renderMarkdown("**bold text**");
    expect(result).toContain("<strong>bold text</strong>");
  });

  test("renders *italic* as <em>", () => {
    const result = renderMarkdown("*italic text*");
    expect(result).toContain("<em>italic text</em>");
  });

  test("renders combined bold and italic", () => {
    const result = renderMarkdown("**bold** and *italic*");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });
});

// ─── Inline code ─────────────────────────────────────────────────────────────

describe("inline code", () => {
  test("renders `code` as <code>", () => {
    const result = renderMarkdown("Use `const x = 1`.");
    expect(result).toContain("<code>const x = 1</code>");
  });

  test("escapes HTML inside inline code", () => {
    const result = renderMarkdown("`<script>`");
    expect(result).toContain("&lt;script&gt;");
    expect(result).not.toContain("<script>");
  });
});

// ─── Bullet lists ────────────────────────────────────────────────────────────

describe("bullet lists", () => {
  test("renders - items as <ul><li>", () => {
    const result = renderMarkdown("- Alpha\n- Beta\n- Gamma");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>Alpha</li>");
    expect(result).toContain("<li>Beta</li>");
    expect(result).toContain("<li>Gamma</li>");
  });
});

// ─── Ordered lists ────────────────────────────────────────────────────────────

describe("ordered lists", () => {
  test("renders 1. items as <ol><li>", () => {
    const result = renderMarkdown("1. First\n2. Second\n3. Third");
    expect(result).toContain("<ol>");
    expect(result).toContain("<li>First</li>");
    expect(result).toContain("<li>Second</li>");
  });
});

// ─── Blockquote ───────────────────────────────────────────────────────────────

describe("blockquote", () => {
  test("renders > lines as <blockquote>", () => {
    const result = renderMarkdown("> This is a quote.");
    expect(result).toContain("<blockquote>");
    expect(result).toContain("This is a quote.");
  });
});

// ─── Horizontal rule ─────────────────────────────────────────────────────────

describe("horizontal rule", () => {
  test("renders --- as <hr>", () => {
    const result = renderMarkdown("---");
    expect(result).toContain("<hr>");
  });
});

// ─── Hard break ──────────────────────────────────────────────────────────────

describe("hard break", () => {
  test("renders trailing two spaces as <br>", () => {
    const result = renderMarkdown("Line one  \nLine two");
    expect(result).toContain("<br>");
  });
});

// ─── Links ───────────────────────────────────────────────────────────────────

describe("links", () => {
  test("renders relative href as anchor", () => {
    const result = renderMarkdown("[Link text](./relative/path)");
    expect(result).toContain('<a href="./relative/path">Link text</a>');
  });

  test("renders anchor href as anchor", () => {
    const result = renderMarkdown("[Jump](#section-title)");
    expect(result).toContain('<a href="#section-title">Jump</a>');
  });

  test("renders absolute path href as anchor", () => {
    const result = renderMarkdown("[Docs](/docs/api)");
    expect(result).toContain('<a href="/docs/api">Docs</a>');
  });

  test("renders external http href as plain text (not link)", () => {
    const result = renderMarkdown("[Evil](https://evil.com/tracker)");
    expect(result).not.toContain("<a ");
    expect(result).toContain("Evil");
    expect(result).not.toContain("https://evil.com");
  });

  test("renders external http:// href as plain text", () => {
    const result = renderMarkdown("[Google](http://google.com)");
    expect(result).not.toContain("<a ");
    expect(result).toContain("Google");
  });
});

// ─── HTML safelist ────────────────────────────────────────────────────────────

describe("HTML safelist", () => {
  test("allows <kbd> passthrough", () => {
    const result = renderMarkdown("Press <kbd>Ctrl+C</kbd> to copy.");
    expect(result).toContain("<kbd>Ctrl+C</kbd>");
  });

  test("allows <span class='pill'> passthrough", () => {
    const result = renderMarkdown('Status: <span class="pill">active</span>');
    expect(result).toContain('<span class="pill">active</span>');
  });

  test("allows <span class='tag'> passthrough", () => {
    const result = renderMarkdown('Label: <span class="tag">beta</span>');
    expect(result).toContain('<span class="tag">beta</span>');
  });

  test("escapes content inside kbd", () => {
    const result = renderMarkdown("Press <kbd><script>alert(1)</script></kbd>.");
    expect(result).toContain("<kbd>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  test("escapes unsafe HTML tags — <script> becomes text", () => {
    const result = renderMarkdown("Injection: <script>alert(1)</script>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  test("escapes <div> — not in safelist", () => {
    const result = renderMarkdown("<div>Custom layout</div>");
    expect(result).not.toContain("<div>");
    expect(result).toContain("&lt;div&gt;");
  });

  test("escapes <img> tag", () => {
    const result = renderMarkdown('<img src="https://evil.com/t.gif">');
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });
});

// ─── Mixed content ────────────────────────────────────────────────────────────

describe("mixed content", () => {
  test("handles markdown within a list item with bold", () => {
    const result = renderMarkdown("- **Important** item\n- Regular item");
    expect(result).toContain("<strong>Important</strong>");
    expect(result).toContain("<li>Regular item</li>");
  });

  test("handles multiple block types in sequence", () => {
    const input = "Intro paragraph.\n\n- Item A\n- Item B\n\n> A quote.\n\n---\n\nConclusion.";
    const result = renderMarkdown(input);
    expect(result).toContain("<p>Intro paragraph.</p>");
    expect(result).toContain("<ul>");
    expect(result).toContain("<blockquote>");
    expect(result).toContain("<hr>");
    expect(result).toContain("<p>Conclusion.</p>");
  });
});

import { describe, expect, test } from "bun:test";
import { extractTextContent } from "../src/render/extract.ts";

describe("extractTextContent — basic extraction", () => {
  test("empty input returns empty string", () => {
    expect(extractTextContent("")).toBe("");
  });

  test("whitespace-only input returns empty string", () => {
    expect(extractTextContent("   \n\t  ")).toBe("");
  });

  test("simple paragraph", () => {
    expect(extractTextContent("<p>hello world</p>")).toBe("hello world");
  });

  test("multiple paragraphs joined with single space", () => {
    const result = extractTextContent("<p>first</p><p>second</p>");
    expect(result).toBe("first second");
  });

  test("nested elements: text in document order", () => {
    const result = extractTextContent("<div><h1>Title</h1><p>Body text here</p></div>");
    expect(result).toContain("Title");
    expect(result).toContain("Body text here");
    // Title comes before body text
    expect(result.indexOf("Title")).toBeLessThan(result.indexOf("Body text here"));
  });
});

describe("extractTextContent — skipped tags", () => {
  test("<script> content is excluded", () => {
    const result = extractTextContent('<script>console.log("secret")</script><p>visible</p>');
    expect(result).toBe("visible");
    expect(result).not.toContain("secret");
    expect(result).not.toContain("console");
  });

  test("<style> content is excluded", () => {
    const result = extractTextContent("<style>.foo { color: red; }</style><p>visible</p>");
    expect(result).toBe("visible");
    expect(result).not.toContain("color");
    expect(result).not.toContain(".foo");
  });

  test("<noscript> content is excluded", () => {
    const result = extractTextContent("<noscript>Enable JavaScript</noscript><p>content</p>");
    expect(result).toBe("content");
    expect(result).not.toContain("Enable JavaScript");
  });

  test("only script in body returns empty string", () => {
    expect(extractTextContent("<script>var x = 1;</script>")).toBe("");
  });
});

describe("extractTextContent — HTML entity decoding", () => {
  test("lt/gt entities decoded", () => {
    const result = extractTextContent("<p>&lt;hello&gt;</p>");
    expect(result).toBe("<hello>");
  });

  test("amp entity decoded", () => {
    const result = extractTextContent("<p>fish &amp; chips</p>");
    expect(result).toBe("fish & chips");
  });

  test("named entity decoded", () => {
    const result = extractTextContent("<p>caf&eacute;</p>");
    expect(result).toBe("café");
  });
});

describe("extractTextContent — whitespace collapse", () => {
  test("multiple spaces collapsed to single", () => {
    const result = extractTextContent("<p>  many   spaces  </p>");
    expect(result).toBe("many spaces");
  });

  test("newlines and tabs collapsed to single space", () => {
    const result = extractTextContent("<p>line one\n\nline two\ttab</p>");
    expect(result).toBe("line one line two tab");
  });

  test("no leading or trailing whitespace", () => {
    const result = extractTextContent("  <p>  trimmed  </p>  ");
    expect(result).not.toMatch(/^\s/);
    expect(result).not.toMatch(/\s$/);
  });
});

describe("extractTextContent — truncation", () => {
  test("short input under maxChars is returned as-is", () => {
    const result = extractTextContent("<p>hello</p>", 100);
    expect(result).toBe("hello");
  });

  test("truncation: result length does not exceed maxChars", () => {
    const longText = "word ".repeat(1200); // ~6000 chars
    const input = `<p>${longText}</p>`;
    const result = extractTextContent(input, 100);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  test("truncation: word-boundary — does not end mid-word when space is within last 100 chars", () => {
    // Build a 95-char base + " incomplete" (10 chars) = 106 total
    // Hard cut at 100 would land in the middle of "incomplete"
    // Word-boundary cut should trim back to the space at position 95
    const base = "a".repeat(95); // 95 chars
    const suffix = " incomplete word"; // 16 chars
    const full = base + suffix; // 111 total
    const input = `<p>${full}</p>`;
    const result = extractTextContent(input, 100);
    // Window = slice(0,100) = base(95) + " incomple" (5 chars)
    // lastSpace in window is at index 95
    // result = slice(0, 95).trimEnd() = base
    expect(result).toBe(base);
    expect(result.length).toBeLessThanOrEqual(100);
    // Ends cleanly at a word boundary (no trailing space, last char is 'a')
    expect(result.slice(-1)).toBe("a");
  });

  test("truncation: hard cut when no whitespace in window", () => {
    // A single word longer than maxChars — must hard cut
    const longWord = "x".repeat(200);
    const result = extractTextContent(`<p>${longWord}</p>`, 100);
    expect(result.length).toBe(100);
    expect(result).toBe("x".repeat(100));
  });

  test("default maxChars is 5000", () => {
    const longText = "word ".repeat(1200); // ~6000 chars including spaces
    const result = extractTextContent(`<p>${longText}</p>`);
    expect(result.length).toBeLessThanOrEqual(5000);
  });
});

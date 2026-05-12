// Tests for server-side syntax highlighting via shiki.
// test/blocks-highlight.test.ts

import { test, expect } from "bun:test";
import { highlightCode, SUPPORTED_LANGUAGES } from "../src/render/blocks/highlight.ts";

// ─── Basic highlighting ───────────────────────────────────────────────────────

test("highlightCode returns styled HTML for TypeScript", async () => {
  const result = await highlightCode("const x = 1;", "typescript");
  // shiki emits token spans with inline color styles
  expect(result).toContain('<span style="color:');
  // Content is wrapped in line spans
  expect(result).toContain('<span class="line">');
});

test("highlightCode returns styled HTML for ts alias", async () => {
  const result = await highlightCode("let y = 'hello';", "ts");
  expect(result).toContain('<span style="color:');
  expect(result).toContain('<span class="line">');
});

test("highlightCode returns styled HTML for python", async () => {
  const result = await highlightCode("def greet(name):\n    print(f'hello {name}')", "python");
  expect(result).toContain('<span style="color:');
  expect(result).toContain('<span class="line">');
});

test("highlightCode returns styled HTML for bash", async () => {
  const result = await highlightCode("echo 'hello world'", "bash");
  expect(result).toContain('<span style="color:');
});

test("highlightCode returns styled HTML for json", async () => {
  const result = await highlightCode('{"key": "value"}', "json");
  expect(result).toContain('<span style="color:');
});

// ─── Multi-line output ────────────────────────────────────────────────────────

test("highlightCode produces one line span per source line", async () => {
  const code = "const a = 1;\nconst b = 2;\nconst c = 3;";
  const result = await highlightCode(code, "typescript");
  const lineSpans = (result.match(/<span class="line">/g) ?? []).length;
  expect(lineSpans).toBe(3);
});

// ─── Unsupported language fallback ───────────────────────────────────────────

test("unsupported lang falls back to plain escaped output without crashing", async () => {
  const result = await highlightCode("+++-.", "brainfuck");
  // No color tokens
  expect(result).not.toContain('<span style="color:');
  // Content is still present
  expect(result).toContain("+++-.");
  // Still wrapped in line spans
  expect(result).toContain('<span class="line">');
});

test("wacky unsupported lang falls back gracefully", async () => {
  const result = await highlightCode("hello world", "wackyfutureLang");
  expect(result).not.toContain('<span style="color:');
  expect(result).toContain("hello world");
});

// ─── XSS / HTML injection prevention ─────────────────────────────────────────

test("angle brackets in code are escaped (supported lang)", async () => {
  const result = await highlightCode("<script>alert(1)</script>", "html");
  // shiki escapes < as &#x3C; in HTML mode
  expect(result).not.toMatch(/<script>alert/);
});

test("angle brackets in code are escaped (unsupported lang fallback)", async () => {
  const result = await highlightCode("<script>alert(1)</script>", "unknownlang");
  expect(result).not.toContain("<script>alert");
  expect(result).toContain("&lt;script&gt;");
});

test("ampersands in code are escaped in fallback path", async () => {
  const result = await highlightCode("a && b", "unknownlang");
  // escapeHtml converts & → &amp;
  expect(result).toContain("&amp;&amp;");
});

test("double quotes in code are escaped in fallback path", async () => {
  const result = await highlightCode('say "hello"', "unknownlang");
  expect(result).toContain("&quot;");
});

// ─── Highlighter singleton / caching ─────────────────────────────────────────

test("second call does not throw and returns consistent output", async () => {
  const a = await highlightCode("const x = 1;", "typescript");
  const b = await highlightCode("const x = 1;", "typescript");
  expect(a).toBe(b);
});

test("concurrent first calls both resolve to valid output", async () => {
  const [a, b] = await Promise.all([
    highlightCode("const a = 1;", "typescript"),
    highlightCode("const b = 2;", "typescript"),
  ]);
  expect(a).toContain('<span style="color:');
  expect(b).toContain('<span style="color:');
});

// ─── SUPPORTED_LANGUAGES contract ────────────────────────────────────────────

test("SUPPORTED_LANGUAGES is a non-empty readonly array", () => {
  expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
  expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(20);
});

test("SUPPORTED_LANGUAGES includes expected languages", () => {
  const mustHave = ["typescript", "ts", "javascript", "js", "python", "bash", "json", "yaml"];
  for (const lang of mustHave) {
    expect(SUPPORTED_LANGUAGES).toContain(lang);
  }
});

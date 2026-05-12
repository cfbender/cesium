// Tests for server-side syntax highlighting via shiki.
// test/blocks-highlight.test.ts

import { test, expect, describe } from "bun:test";
import {
  highlightCode,
  resolveHighlightTheme,
  SUPPORTED_LANGUAGES,
} from "../src/render/blocks/highlight.ts";

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

// ─── resolveHighlightTheme ────────────────────────────────────────────────────

describe("resolveHighlightTheme", () => {
  test("claret-dark → claret-dark", () => {
    expect(resolveHighlightTheme("claret-dark")).toBe("claret-dark");
  });

  test("claret (alias) → claret-dark", () => {
    expect(resolveHighlightTheme("claret")).toBe("claret-dark");
  });

  test("claret-light → claret-light", () => {
    expect(resolveHighlightTheme("claret-light")).toBe("claret-light");
  });

  test("warm → vitesse-dark (dark code panel)", () => {
    expect(resolveHighlightTheme("warm")).toBe("vitesse-dark");
  });

  test("cool → vitesse-dark (dark code panel)", () => {
    expect(resolveHighlightTheme("cool")).toBe("vitesse-dark");
  });

  test("mono → vitesse-dark (dark code panel)", () => {
    expect(resolveHighlightTheme("mono")).toBe("vitesse-dark");
  });

  test("paper → vitesse-dark (dark code panel)", () => {
    expect(resolveHighlightTheme("paper")).toBe("vitesse-dark");
  });

  test("undefined → vitesse-dark", () => {
    expect(resolveHighlightTheme(undefined)).toBe("vitesse-dark");
  });

  test("unknown string → vitesse-dark", () => {
    expect(resolveHighlightTheme("mystery-theme")).toBe("vitesse-dark");
  });
});

// ─── claret-dark / claret-light theme colors ──────────────────────────────────
// Colors verified against:
//   dark: /claret.nvim/ports/bat/ClaretDark.tmTheme (canonical source)
//   light: /claret.nvim/lua/claret/palette.lua (light section)

describe("claret-dark theme colors", () => {
  test("highlighted keyword includes claret rose #C75B7A (from tmTheme)", async () => {
    // 'const' is a storage.type keyword — tmTheme: Keyword scope → #C75B7A
    const result = await highlightCode("const x = 1;", "typescript", "claret-dark");
    expect(result).toContain('<span style="color:');
    expect(result.toLowerCase()).toContain("#c75b7a");
  });

  test("highlighted string includes sage green #8FA86E (from tmTheme)", async () => {
    // tmTheme: String scope → #8FA86E
    const result = await highlightCode('const s = "hello";', "typescript", "claret-dark");
    expect(result.toLowerCase()).toContain("#8fa86e");
  });

  test("comment uses gutter foreground #71685E italic (from tmTheme)", async () => {
    // tmTheme: Comment scope → #71685E italic
    const result = await highlightCode("// comment", "typescript", "claret-dark");
    expect(result.toLowerCase()).toContain("#71685e");
  });

  test("function name uses gold #D4A76A (from tmTheme)", async () => {
    // tmTheme: Function scope → #D4A76A
    const result = await highlightCode("function greet() {}", "typescript", "claret-dark");
    expect(result.toLowerCase()).toContain("#d4a76a");
  });
});

describe("claret-light theme colors", () => {
  test("highlighted keyword includes light rose #B80842 (from light palette rose_1)", async () => {
    // light palette rose_1 = #B80842
    const result = await highlightCode("const x = 1;", "typescript", "claret-light");
    expect(result).toContain('<span style="color:');
    expect(result.toLowerCase()).toContain("#b80842");
  });

  test("highlighted string includes light sage #1B5500 (from light palette sage_1)", async () => {
    // light palette sage_1 = #1B5500
    const result = await highlightCode('const s = "hello";', "typescript", "claret-light");
    expect(result.toLowerCase()).toContain("#1b5500");
  });

  test("comment uses muted warm gray #928578 (from light palette text_4)", async () => {
    // light palette text_4 = #928578
    const result = await highlightCode("// comment", "typescript", "claret-light");
    expect(result.toLowerCase()).toContain("#928578");
  });

  test("function name uses light gold #946000 (from light palette gold_1)", async () => {
    // light palette gold_1 = #946000
    const result = await highlightCode("function greet() {}", "typescript", "claret-light");
    expect(result.toLowerCase()).toContain("#946000");
  });
});

// ─── All four themes load and produce distinct output ─────────────────────────

describe("all four themes produce distinct output", () => {
  const snippet = 'const greet = (name: string): string => `Hello, ${name}!`;';

  test("claret-dark and vitesse-dark differ on same input", async () => {
    const [a, b] = await Promise.all([
      highlightCode(snippet, "typescript", "claret-dark"),
      highlightCode(snippet, "typescript", "vitesse-dark"),
    ]);
    expect(a).not.toBe(b);
  });

  test("claret-light and vitesse-light differ on same input", async () => {
    const [a, b] = await Promise.all([
      highlightCode(snippet, "typescript", "claret-light"),
      highlightCode(snippet, "typescript", "vitesse-light"),
    ]);
    expect(a).not.toBe(b);
  });

  test("claret-dark and claret-light differ on same input", async () => {
    const [a, b] = await Promise.all([
      highlightCode(snippet, "typescript", "claret-dark"),
      highlightCode(snippet, "typescript", "claret-light"),
    ]);
    expect(a).not.toBe(b);
  });

  test("all four themes produce non-empty highlighted output", async () => {
    const themes = ["claret-dark", "claret-light", "vitesse-dark", "vitesse-light"] as const;
    const results = await Promise.all(
      themes.map((theme) => highlightCode(snippet, "typescript", theme)),
    );
    for (const result of results) {
      expect(result).toContain('<span style="color:');
      expect(result).toContain('<span class="line">');
    }
  });
});

// ─── Fallback theme default ───────────────────────────────────────────────────

test("highlightCode with no theme argument defaults to vitesse-dark", async () => {
  const withDefault = await highlightCode("const x = 1;", "typescript");
  const withExplicit = await highlightCode("const x = 1;", "typescript", "vitesse-dark");
  expect(withDefault).toBe(withExplicit);
});

import { describe, expect, test } from "bun:test";
import { wrapDocument, type ArtifactMeta } from "../src/render/wrap.ts";
import { defaultTheme } from "../src/render/theme.ts";

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

  test("includes <style> with framework css", () => {
    const doc = wrapDocument({ body: "<p>hi</p>", meta: makeMeta(), theme: defaultTheme() });
    expect(doc).toContain("<style>");
    expect(doc).toContain(":root");
    expect(doc).toContain("--accent");
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

  test("inline <style> includes both framework rules AND fallback tokens", () => {
    const doc = wrapDocument({ body: "<p>hi</p>", meta: makeMeta(), theme: defaultTheme() });
    const styleMatch = /<style>([\s\S]*?)<\/style>/i.exec(doc);
    expect(styleMatch).not.toBeNull();
    const styleContent = styleMatch?.[1] ?? "";
    // Framework rules
    expect(styleContent).toContain(".eyebrow");
    expect(styleContent).toContain(".card");
    // Fallback tokens
    expect(styleContent).toContain(":root");
    expect(styleContent).toContain("--bg:");
    expect(styleContent).toContain("--accent:");
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
});

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
});

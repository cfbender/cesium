import { test, expect, describe } from "bun:test";
import {
  renderProjectIndex,
  renderGlobalIndex,
  summarizeProject,
  type ProjectSummary,
} from "../src/storage/index-gen.ts";
import type { IndexEntry } from "../src/storage/index-cache.ts";
import { defaultTheme } from "../src/render/theme.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<IndexEntry> & { id: string; createdAt: string }): IndexEntry {
  return {
    id: overrides.id,
    title: overrides.title ?? `Title ${overrides.id}`,
    kind: overrides.kind ?? "plan",
    summary: overrides.summary ?? null,
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt,
    filename: overrides.filename ?? `${overrides.id}.html`,
    supersedes: overrides.supersedes ?? null,
    supersededBy: overrides.supersededBy ?? null,
    gitBranch: null,
    gitCommit: null,
    contentSha256: "deadbeef",
    projectSlug: overrides.projectSlug ?? "test-project",
    projectName: overrides.projectName ?? "Test Project",
    bodyText: overrides.bodyText ?? "",
  };
}

const theme = defaultTheme();

// ─── renderProjectIndex ──────────────────────────────────────────────────────

describe("renderProjectIndex", () => {
  test("returns a complete html document starting with <!doctype html>", () => {
    const html = renderProjectIndex({
      projectSlug: "my-proj",
      projectName: "My Project",
      entries: [],
      theme,
    });
    expect(html.toLowerCase().trimStart()).toMatch(/^<!doctype html>/);
    expect(html).toContain("</html>");
  });

  test("output contains projectName in <title> and h-display", () => {
    const html = renderProjectIndex({
      projectSlug: "my-proj",
      projectName: "My Project",
      entries: [],
      theme,
    });
    expect(html).toContain("<title>My Project · cesium</title>");
    expect(html).toContain("h-display");
    expect(html).toContain("My Project");
  });

  test("empty entries shows empty-state copy", () => {
    const html = renderProjectIndex({
      projectSlug: "my-proj",
      projectName: "My Project",
      entries: [],
      theme,
    });
    expect(html).toContain("No artifacts published yet.");
  });

  test("three entries of different kinds: all titles appear in output", () => {
    const entries = [
      makeEntry({ id: "a1", createdAt: "2026-05-11T10:00:00Z", kind: "plan", title: "Plan Alpha" }),
      makeEntry({
        id: "b2",
        createdAt: "2026-05-11T11:00:00Z",
        kind: "design",
        title: "Design Beta",
      }),
      makeEntry({
        id: "c3",
        createdAt: "2026-05-11T12:00:00Z",
        kind: "report",
        title: "Report Gamma",
      }),
    ];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    expect(html).toContain("Plan Alpha");
    expect(html).toContain("Design Beta");
    expect(html).toContain("Report Gamma");
  });

  test("filter chip row contains 'All' and one chip per distinct kind", () => {
    const entries = [
      makeEntry({ id: "a1", createdAt: "2026-05-11T10:00:00Z", kind: "plan" }),
      makeEntry({ id: "b2", createdAt: "2026-05-11T11:00:00Z", kind: "design" }),
      makeEntry({ id: "c3", createdAt: "2026-05-11T12:00:00Z", kind: "plan" }),
    ];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    // "All" chip
    expect(html).toContain(">All<");
    // kind chips
    expect(html).toContain('data-kind="plan"');
    expect(html).toContain('data-kind="design"');
    // only two distinct kinds
    const planCount = (html.match(/data-kind="plan"/g) ?? []).length;
    const designCount = (html.match(/data-kind="design"/g) ?? []).length;
    expect(planCount).toBeGreaterThanOrEqual(1);
    expect(designCount).toBeGreaterThanOrEqual(1);
  });

  test("search input is present", () => {
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries: [], theme });
    expect(html).toContain('type="search"');
    expect(html).toContain("cesium-search");
  });

  test("output contains inline <script> and <style> blocks", () => {
    const entries = [makeEntry({ id: "a1", createdAt: "2026-05-11T10:00:00Z" })];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    expect(html).toContain("<script>");
    expect(html).toContain("</script>");
    expect(html).toContain("<style>");
    expect(html).toContain("</style>");
  });

  test("superseded entry gets data-superseded='1'", () => {
    const entries = [
      makeEntry({ id: "v1", createdAt: "2026-05-10T10:00:00Z", supersededBy: "v2" }),
      makeEntry({ id: "v2", createdAt: "2026-05-11T10:00:00Z", supersedes: "v1" }),
    ];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    expect(html).toContain('data-superseded="1"');
    // The non-superseded one should have data-superseded="0"
    expect(html).toContain('data-superseded="0"');
  });

  test("week grouping: same-week entries appear in one section", () => {
    // Both entries in the same ISO week (Mon 2026-05-11)
    const entries = [
      makeEntry({ id: "a", createdAt: "2026-05-11T08:00:00Z", title: "Monday Entry" }),
      makeEntry({ id: "b", createdAt: "2026-05-13T08:00:00Z", title: "Wednesday Entry" }),
    ];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    // Both in same week — there should be exactly one week-section with both titles
    const sectionCount = (html.match(/class="week-section"/g) ?? []).length;
    expect(sectionCount).toBe(1);
    expect(html).toContain("Monday Entry");
    expect(html).toContain("Wednesday Entry");
  });

  test("week grouping: entries in different weeks produce separate sections", () => {
    const entries = [
      makeEntry({ id: "a", createdAt: "2026-05-04T08:00:00Z", title: "Previous Week" }),
      makeEntry({ id: "b", createdAt: "2026-05-11T08:00:00Z", title: "This Week" }),
    ];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    const sectionCount = (html.match(/class="week-section"/g) ?? []).length;
    expect(sectionCount).toBe(2);
  });

  test("entry card links to artifacts/<filename>", () => {
    const entries = [
      makeEntry({
        id: "abc",
        createdAt: "2026-05-11T10:00:00Z",
        filename: "abc.html",
        title: "My Card",
      }),
    ];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    expect(html).toContain('href="artifacts/abc.html"');
  });

  test("entry card tags are rendered as .tag chips", () => {
    const entries = [
      makeEntry({ id: "t1", createdAt: "2026-05-11T10:00:00Z", tags: ["alpha", "beta"] }),
    ];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    expect(html).toContain("alpha");
    expect(html).toContain("beta");
    expect(html).toContain('class="tag"');
  });

  test("entry summary is rendered when present", () => {
    const entries = [
      makeEntry({ id: "s1", createdAt: "2026-05-11T10:00:00Z", summary: "Short summary text" }),
    ];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    expect(html).toContain("Short summary text");
  });

  test("no external resources in output", () => {
    const entries = [makeEntry({ id: "x", createdAt: "2026-05-11T10:00:00Z" })];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    expect(html).not.toMatch(/src="https?:\/\//);
    // Only relative hrefs are allowed; no absolute external ones
    const hrefMatches = html.match(/href="https?:\/\//g) ?? [];
    expect(hrefMatches).toHaveLength(0);
  });

  test("entry card has data-body-text attribute", () => {
    const entries = [
      makeEntry({ id: "bt1", createdAt: "2026-05-11T10:00:00Z", bodyText: "Hello World" }),
    ];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    expect(html).toContain("data-body-text=");
  });

  test("data-body-text attribute value is lowercased", () => {
    const entries = [
      makeEntry({ id: "bt2", createdAt: "2026-05-11T10:00:00Z", bodyText: "UPPERCASE Content" }),
    ];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    expect(html).toContain('data-body-text="uppercase content"');
    expect(html).not.toContain('data-body-text="UPPERCASE Content"');
  });

  test("data-body-text is HTML-attribute-escaped", () => {
    const entries = [
      makeEntry({
        id: "bt3",
        createdAt: "2026-05-11T10:00:00Z",
        bodyText: 'has "quotes" & <brackets>',
      }),
    ];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    // Quotes escaped, & escaped, < escaped
    expect(html).toContain("&quot;quotes&quot;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;");
  });

  test('empty bodyText produces data-body-text=""', () => {
    const entries = [makeEntry({ id: "bt4", createdAt: "2026-05-11T10:00:00Z", bodyText: "" })];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    expect(html).toContain('data-body-text=""');
  });

  test("inline script references dataset.bodyText for search", () => {
    const entries = [makeEntry({ id: "sc1", createdAt: "2026-05-11T10:00:00Z" })];
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries, theme });
    expect(html).toContain("bodyText");
    // The haystack variable includes body text
    expect(html).toContain("haystack");
  });

  test("default themeCssHref includes link to ../../theme.css", () => {
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries: [], theme });
    expect(html).toContain('<link rel="stylesheet" href="../../theme.css">');
  });

  test("custom themeCssHref overrides the link", () => {
    const html = renderProjectIndex({
      projectSlug: "p",
      projectName: "P",
      entries: [],
      theme,
      themeCssHref: "custom/path.css",
    });
    expect(html).toContain('<link rel="stylesheet" href="custom/path.css">');
    expect(html).not.toContain('href="../../theme.css"');
  });

  test("themeCssHref: null suppresses the link", () => {
    const html = renderProjectIndex({
      projectSlug: "p",
      projectName: "P",
      entries: [],
      theme,
      themeCssHref: null,
    });
    expect(html).not.toContain('<link rel="stylesheet"');
  });

  test("default themeCssHref emits favicon link to ../../favicon.svg", () => {
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries: [], theme });
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="../../favicon.svg">');
  });

  test("themeCssHref: null suppresses the favicon link too", () => {
    const html = renderProjectIndex({
      projectSlug: "p",
      projectName: "P",
      entries: [],
      theme,
      themeCssHref: null,
    });
    expect(html).not.toContain('<link rel="icon"');
  });

  test("eyebrow header includes inline favicon emblem next to 'cesium · project'", () => {
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries: [], theme });
    // Emblem + label live inside an .eyebrow.cesium-eyebrow row
    expect(html).toContain('<p class="eyebrow cesium-eyebrow">');
    expect(html).toContain("cesium · project");
    // Inline svg precedes the text label
    const eyebrowMatch = /<p class="eyebrow cesium-eyebrow">([\s\S]*?)<\/p>/.exec(html);
    expect(eyebrowMatch).not.toBeNull();
    const eyebrowContent = eyebrowMatch?.[1] ?? "";
    expect(eyebrowContent).toContain("<svg");
    expect(eyebrowContent).toContain(">Cs<");
    const svgPos = eyebrowContent.indexOf("<svg");
    const textPos = eyebrowContent.indexOf("cesium · project");
    expect(svgPos).toBeGreaterThanOrEqual(0);
    expect(textPos).toBeGreaterThan(svgPos);
  });

  test("inline <style> includes fallback css and index-specific rules", () => {
    const html = renderProjectIndex({ projectSlug: "p", projectName: "P", entries: [], theme });
    const styleMatch = /<style>([\s\S]*?)<\/style>/i.exec(html);
    expect(styleMatch).not.toBeNull();
    const styleContent = styleMatch?.[1] ?? "";
    // Fallback CSS present (minified)
    expect(styleContent).toContain(":root{");
    // Index-specific CSS still present inline
    expect(styleContent).toContain(".filter-chip");
    // Full framework rules NOT inlined (they live in /theme.css)
    expect(styleContent).not.toContain(".h-section");
  });
});

// ─── renderGlobalIndex ───────────────────────────────────────────────────────

describe("renderGlobalIndex", () => {
  test("returns a complete html document starting with <!doctype html>", () => {
    const html = renderGlobalIndex({ projects: [], theme });
    expect(html.toLowerCase().trimStart()).toMatch(/^<!doctype html>/);
  });

  test("empty projects shows empty state", () => {
    const html = renderGlobalIndex({ projects: [], theme });
    expect(html).toContain("No projects published yet.");
  });

  test("two projects: both appear in output", () => {
    const p1: ProjectSummary = {
      slug: "proj-alpha",
      name: "Project Alpha",
      count: 3,
      latestCreatedAt: "2026-05-11T12:00:00Z",
      latestEntries: [],
    };
    const p2: ProjectSummary = {
      slug: "proj-beta",
      name: "Project Beta",
      count: 1,
      latestCreatedAt: "2026-05-10T08:00:00Z",
      latestEntries: [],
    };
    const html = renderGlobalIndex({ projects: [p1, p2], theme });
    expect(html).toContain("Project Alpha");
    expect(html).toContain("Project Beta");
  });

  test("projects sorted by latestCreatedAt desc", () => {
    const newer: ProjectSummary = {
      slug: "newer",
      name: "Newer Project",
      count: 1,
      latestCreatedAt: "2026-05-12T00:00:00Z",
      latestEntries: [],
    };
    const older: ProjectSummary = {
      slug: "older",
      name: "Older Project",
      count: 1,
      latestCreatedAt: "2026-05-01T00:00:00Z",
      latestEntries: [],
    };
    const html = renderGlobalIndex({ projects: [older, newer], theme });
    const newerPos = html.indexOf("Newer Project");
    const olderPos = html.indexOf("Older Project");
    expect(newerPos).toBeLessThan(olderPos);
  });

  test("project cards link to projects/<slug>/index.html", () => {
    const p: ProjectSummary = {
      slug: "my-slug",
      name: "My Proj",
      count: 1,
      latestCreatedAt: "2026-05-11T00:00:00Z",
      latestEntries: [],
    };
    const html = renderGlobalIndex({ projects: [p], theme });
    expect(html).toContain('href="projects/my-slug/index.html"');
  });

  test("title is 'All projects · cesium'", () => {
    const html = renderGlobalIndex({ projects: [], theme });
    expect(html).toContain("<title>All projects · cesium</title>");
  });

  test("default themeCssHref includes link to theme.css", () => {
    const html = renderGlobalIndex({ projects: [], theme });
    expect(html).toContain('<link rel="stylesheet" href="theme.css">');
  });

  test("custom themeCssHref overrides the link", () => {
    const html = renderGlobalIndex({ projects: [], theme, themeCssHref: "custom/theme.css" });
    expect(html).toContain('<link rel="stylesheet" href="custom/theme.css">');
    expect(html).not.toContain('href="theme.css"');
  });

  test("themeCssHref: null suppresses the link", () => {
    const html = renderGlobalIndex({ projects: [], theme, themeCssHref: null });
    expect(html).not.toContain('<link rel="stylesheet"');
  });

  test("default themeCssHref emits favicon link to favicon.svg", () => {
    const html = renderGlobalIndex({ projects: [], theme });
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="favicon.svg">');
  });

  test("themeCssHref: null suppresses the favicon link too", () => {
    const html = renderGlobalIndex({ projects: [], theme, themeCssHref: null });
    expect(html).not.toContain('<link rel="icon"');
  });

  test("eyebrow header includes inline favicon emblem next to 'cesium'", () => {
    const html = renderGlobalIndex({ projects: [], theme });
    expect(html).toContain('<p class="eyebrow cesium-eyebrow">');
    const eyebrowMatch = /<p class="eyebrow cesium-eyebrow">([\s\S]*?)<\/p>/.exec(html);
    expect(eyebrowMatch).not.toBeNull();
    const eyebrowContent = eyebrowMatch?.[1] ?? "";
    expect(eyebrowContent).toContain("<svg");
    expect(eyebrowContent).toContain(">Cs<");
    expect(eyebrowContent).toContain("cesium");
  });

  test("inline <style> includes fallback css", () => {
    const html = renderGlobalIndex({ projects: [], theme });
    const styleMatch = /<style>([\s\S]*?)<\/style>/i.exec(html);
    expect(styleMatch).not.toBeNull();
    const styleContent = styleMatch?.[1] ?? "";
    // Fallback CSS present (minified, no CSS vars)
    expect(styleContent).toContain(":root{");
    expect(styleContent).toContain("system-ui");
    // Full framework rules NOT inlined
    expect(styleContent).not.toContain(".h-section");
  });
});

// ─── summarizeProject ────────────────────────────────────────────────────────

describe("summarizeProject", () => {
  test("returns correct count", () => {
    const entries = [
      makeEntry({ id: "a", createdAt: "2026-05-10T00:00:00Z" }),
      makeEntry({ id: "b", createdAt: "2026-05-11T00:00:00Z" }),
    ];
    const s = summarizeProject({ slug: "p", name: "P", entries });
    expect(s.count).toBe(2);
  });

  test("latestCreatedAt is the most recent entry", () => {
    const entries = [
      makeEntry({ id: "a", createdAt: "2026-05-09T00:00:00Z" }),
      makeEntry({ id: "b", createdAt: "2026-05-11T12:00:00Z" }),
      makeEntry({ id: "c", createdAt: "2026-05-10T00:00:00Z" }),
    ];
    const s = summarizeProject({ slug: "p", name: "P", entries });
    expect(s.latestCreatedAt).toBe("2026-05-11T12:00:00Z");
  });

  test("topN entries capped at default 5", () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      makeEntry({ id: `e${i}`, createdAt: `2026-05-0${i + 1}T00:00:00Z` }),
    );
    const s = summarizeProject({ slug: "p", name: "P", entries });
    expect(s.latestEntries.length).toBe(5);
  });

  test("topN can be overridden", () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      makeEntry({ id: `e${i}`, createdAt: `2026-05-0${i + 1}T00:00:00Z` }),
    );
    const s = summarizeProject({ slug: "p", name: "P", entries, topN: 3 });
    expect(s.latestEntries.length).toBe(3);
  });

  test("empty entries: count 0 and sensible latestCreatedAt", () => {
    const s = summarizeProject({ slug: "p", name: "P", entries: [] });
    expect(s.count).toBe(0);
    expect(s.latestEntries.length).toBe(0);
    // latestCreatedAt falls back to epoch
    expect(new Date(s.latestCreatedAt).getTime()).toBe(0);
  });

  test("latestEntries are sorted newest first", () => {
    const entries = [
      makeEntry({ id: "a", createdAt: "2026-05-09T00:00:00Z" }),
      makeEntry({ id: "b", createdAt: "2026-05-11T00:00:00Z" }),
      makeEntry({ id: "c", createdAt: "2026-05-10T00:00:00Z" }),
    ];
    const s = summarizeProject({ slug: "p", name: "P", entries });
    expect(s.latestEntries[0]?.id).toBe("b");
    expect(s.latestEntries[1]?.id).toBe("c");
    expect(s.latestEntries[2]?.id).toBe("a");
  });
});

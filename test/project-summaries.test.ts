import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProjectSummaries, type ProjectSummary } from "../src/storage/project-summaries.ts";
import type { IndexEntry } from "../src/storage/index-cache.ts";

let workDir: string;
beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "cesium-ps-test-"));
});
afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function makeEntry(
  id: string,
  projectSlug: string,
  projectName: string,
  createdAt: string,
): IndexEntry {
  return {
    id,
    title: `Title ${id}`,
    kind: "plan",
    summary: null,
    tags: [],
    createdAt,
    filename: `${id}.html`,
    supersedes: null,
    supersededBy: null,
    gitBranch: null,
    gitCommit: null,
    contentSha256: "deadbeef",
    projectSlug,
    projectName,
    bodyText: "",
  };
}

describe("buildProjectSummaries", () => {
  test("empty entries → empty array", () => {
    const result = buildProjectSummaries([]);
    expect(result).toEqual([]);
  });

  test("one project with one entry → one summary with correct fields", () => {
    const entries: IndexEntry[] = [
      makeEntry("a1", "my-project", "My Project", "2026-05-11T10:00:00.000Z"),
    ];
    const result = buildProjectSummaries(entries);
    expect(result).toHaveLength(1);
    const summary = result[0] as ProjectSummary;
    expect(summary.slug).toBe("my-project");
    expect(summary.name).toBe("My Project");
    expect(summary.count).toBe(1);
    expect(summary.latestCreatedAt).toBe("2026-05-11T10:00:00.000Z");
    expect(summary.latestEntries).toHaveLength(1);
    expect(summary.latestEntries[0]?.id).toBe("a1");
  });

  test("multiple projects grouped correctly", () => {
    const entries: IndexEntry[] = [
      makeEntry("a1", "proj-alpha", "Alpha", "2026-05-10T10:00:00.000Z"),
      makeEntry("b1", "proj-beta", "Beta", "2026-05-11T10:00:00.000Z"),
      makeEntry("a2", "proj-alpha", "Alpha", "2026-05-09T10:00:00.000Z"),
    ];
    const result = buildProjectSummaries(entries);
    expect(result).toHaveLength(2);
    const alpha = result.find((s) => s.slug === "proj-alpha");
    const beta = result.find((s) => s.slug === "proj-beta");
    expect(alpha).toBeDefined();
    expect(beta).toBeDefined();
    expect(alpha?.count).toBe(2);
    expect(beta?.count).toBe(1);
  });

  test("multiple projects sorted by latestCreatedAt desc", () => {
    const entries: IndexEntry[] = [
      makeEntry("a1", "proj-alpha", "Alpha", "2026-05-08T10:00:00.000Z"),
      makeEntry("b1", "proj-beta", "Beta", "2026-05-11T10:00:00.000Z"),
      makeEntry("c1", "proj-gamma", "Gamma", "2026-05-09T10:00:00.000Z"),
    ];
    const result = buildProjectSummaries(entries);
    // buildProjectSummaries does NOT sort; ordering is insertion-order from Map.
    // Each project's latestCreatedAt should reflect its actual latest entry.
    expect(result.find((s) => s.slug === "proj-alpha")?.latestCreatedAt).toBe(
      "2026-05-08T10:00:00.000Z",
    );
    expect(result.find((s) => s.slug === "proj-beta")?.latestCreatedAt).toBe(
      "2026-05-11T10:00:00.000Z",
    );
    expect(result.find((s) => s.slug === "proj-gamma")?.latestCreatedAt).toBe(
      "2026-05-09T10:00:00.000Z",
    );
  });

  test("project with multiple entries reports correct latestCreatedAt", () => {
    const entries: IndexEntry[] = [
      makeEntry("a1", "proj-x", "X", "2026-05-09T10:00:00.000Z"),
      makeEntry("a2", "proj-x", "X", "2026-05-11T12:00:00.000Z"),
      makeEntry("a3", "proj-x", "X", "2026-05-07T08:00:00.000Z"),
    ];
    const result = buildProjectSummaries(entries);
    expect(result).toHaveLength(1);
    const summary = result[0] as ProjectSummary;
    expect(summary.count).toBe(3);
    expect(summary.latestCreatedAt).toBe("2026-05-11T12:00:00.000Z");
    // latestEntries is top-5 by date desc; first entry should be a2
    expect(summary.latestEntries[0]?.id).toBe("a2");
  });

  test("latestEntries capped at 5 for large projects", () => {
    const entries: IndexEntry[] = Array.from({ length: 8 }, (_, i) =>
      makeEntry(`id${i}`, "proj-big", "Big", `2026-05-0${i + 1}T10:00:00.000Z`),
    );
    const result = buildProjectSummaries(entries);
    expect(result).toHaveLength(1);
    const summary = result[0] as ProjectSummary;
    expect(summary.count).toBe(8);
    expect(summary.latestEntries).toHaveLength(5);
  });

  test("entries without a matching projectSlug grouping are isolated to own bucket", () => {
    const entries: IndexEntry[] = [
      makeEntry("x1", "slug-one", "One", "2026-05-11T10:00:00.000Z"),
      makeEntry("x2", "slug-two", "Two", "2026-05-11T10:00:00.000Z"),
    ];
    const result = buildProjectSummaries(entries);
    expect(result).toHaveLength(2);
    const slugs = result.map((s) => s.slug).toSorted();
    expect(slugs).toEqual(["slug-one", "slug-two"]);
  });
});

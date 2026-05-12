import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWrite } from "../src/storage/write.ts";
import {
  appendEntry,
  loadIndex,
  patchEntry,
  writeIndex,
  type IndexEntry,
} from "../src/storage/index-cache.ts";

let workDir: string;
beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "cesium-test-"));
});
afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function makeEntry(id: string, createdAt: string): IndexEntry {
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
    projectSlug: "test-project",
    projectName: "Test Project",
    bodyText: "",
  };
}

describe("loadIndex", () => {
  test("returns empty array for missing file", async () => {
    const result = await loadIndex(join(workDir, "missing.json"));
    expect(result).toEqual([]);
  });

  test("parses valid JSON array", async () => {
    const entry = makeEntry("abc", "2026-05-11T14:00:00.000Z");
    const jsonPath = join(workDir, "index.json");
    await atomicWrite(jsonPath, JSON.stringify([entry]));
    const result = await loadIndex(jsonPath);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("abc");
  });

  test("throws on malformed JSON", async () => {
    const jsonPath = join(workDir, "bad.json");
    await atomicWrite(jsonPath, "{not valid json");
    await expect(loadIndex(jsonPath)).rejects.toThrow();
  });

  test("throws if root is not an array", async () => {
    const jsonPath = join(workDir, "obj.json");
    await atomicWrite(jsonPath, JSON.stringify({ entries: [] }));
    await expect(loadIndex(jsonPath)).rejects.toThrow("not an array");
  });

  test("returns multiple entries", async () => {
    const entries = [
      makeEntry("a", "2026-05-10T10:00:00.000Z"),
      makeEntry("b", "2026-05-11T10:00:00.000Z"),
    ];
    const jsonPath = join(workDir, "index.json");
    await atomicWrite(jsonPath, JSON.stringify(entries));
    const result = await loadIndex(jsonPath);
    expect(result).toHaveLength(2);
  });
});

describe("writeIndex", () => {
  test("writes pretty-printed JSON", async () => {
    const jsonPath = join(workDir, "index.json");
    const entries = [makeEntry("abc", "2026-05-11T14:00:00.000Z")];
    await writeIndex(jsonPath, entries);
    const raw = await Bun.file(jsonPath).text();
    expect(raw).toContain("\n");
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
  });

  test("round-trips through loadIndex", async () => {
    const jsonPath = join(workDir, "index.json");
    const entries = [makeEntry("abc", "2026-05-11T14:00:00.000Z")];
    await writeIndex(jsonPath, entries);
    const loaded = await loadIndex(jsonPath);
    expect(loaded).toEqual(entries);
  });
});

describe("appendEntry", () => {
  test("returns new array sorted by createdAt desc", () => {
    const existing = [makeEntry("a", "2026-05-10T10:00:00.000Z")];
    const newEntry = makeEntry("b", "2026-05-11T10:00:00.000Z");
    const result = appendEntry(existing, newEntry);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("b");
    expect(result[1]?.id).toBe("a");
  });

  test("does not mutate original array", () => {
    const existing = [makeEntry("a", "2026-05-10T10:00:00.000Z")];
    appendEntry(existing, makeEntry("b", "2026-05-11T10:00:00.000Z"));
    expect(existing).toHaveLength(1);
  });

  test("works with empty array", () => {
    const result = appendEntry([], makeEntry("a", "2026-05-11T10:00:00.000Z"));
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("a");
  });

  test("sorts correctly when inserting older entry", () => {
    const existing = [makeEntry("newer", "2026-05-12T10:00:00.000Z")];
    const result = appendEntry(existing, makeEntry("older", "2026-05-10T10:00:00.000Z"));
    expect(result[0]?.id).toBe("newer");
    expect(result[1]?.id).toBe("older");
  });
});

describe("patchEntry", () => {
  test("patches a field by id", () => {
    const entries = [makeEntry("abc", "2026-05-11T10:00:00.000Z")];
    const result = patchEntry(entries, "abc", { supersededBy: "xyz" });
    expect(result[0]?.supersededBy).toBe("xyz");
  });

  test("returns original array unchanged for missing id", () => {
    const entries = [makeEntry("abc", "2026-05-11T10:00:00.000Z")];
    const result = patchEntry(entries, "nonexistent", { supersededBy: "xyz" });
    expect(result).toEqual(entries);
    expect(result).toBe(entries);
  });

  test("does not mutate original array", () => {
    const entries = [makeEntry("abc", "2026-05-11T10:00:00.000Z")];
    patchEntry(entries, "abc", { supersededBy: "xyz" });
    expect(entries[0]?.supersededBy).toBeNull();
  });

  test("preserves non-patched fields", () => {
    const entries = [makeEntry("abc", "2026-05-11T10:00:00.000Z")];
    const result = patchEntry(entries, "abc", { supersededBy: "xyz" });
    expect(result[0]?.id).toBe("abc");
    expect(result[0]?.title).toBe("Title abc");
    expect(result[0]?.kind).toBe("plan");
  });

  test("preserves bodyText when patching other fields", () => {
    const entry = {
      ...makeEntry("abc", "2026-05-11T10:00:00.000Z"),
      bodyText: "some content here",
    };
    const result = patchEntry([entry], "abc", { supersededBy: "xyz" });
    expect(result[0]?.bodyText).toBe("some content here");
  });
});

describe("loadIndex — bodyText backward-compat", () => {
  test("entry without bodyText in JSON defaults to empty string", async () => {
    const jsonPath = join(workDir, "old.json");
    // Simulate a pre-v0.1.5 entry without the bodyText field
    const oldEntry = {
      id: "old1",
      title: "Old Title",
      kind: "plan",
      summary: null,
      tags: [],
      createdAt: "2026-05-11T10:00:00.000Z",
      filename: "old1.html",
      supersedes: null,
      supersededBy: null,
      gitBranch: null,
      gitCommit: null,
      contentSha256: "deadbeef",
      projectSlug: "test-project",
      projectName: "Test Project",
      // bodyText intentionally absent
    };
    await atomicWrite(jsonPath, JSON.stringify([oldEntry]));
    const result = await loadIndex(jsonPath);
    expect(result).toHaveLength(1);
    expect(result[0]?.bodyText).toBe("");
  });

  test("entry with bodyText in JSON preserves it", async () => {
    const jsonPath = join(workDir, "new.json");
    const entry = { ...makeEntry("x1", "2026-05-11T10:00:00.000Z"), bodyText: "rich content" };
    await atomicWrite(jsonPath, JSON.stringify([entry]));
    const result = await loadIndex(jsonPath);
    expect(result[0]?.bodyText).toBe("rich content");
  });
});

describe("appendEntry — bodyText preserved", () => {
  test("appendEntry preserves bodyText on entries", () => {
    const entry = { ...makeEntry("a", "2026-05-11T10:00:00.000Z"), bodyText: "hello world" };
    const result = appendEntry([], entry);
    expect(result[0]?.bodyText).toBe("hello world");
  });
});

// ─── Phase 2.5 Bug 4: inputMode ─────────────────────────────────────────────

describe("IndexEntry inputMode", () => {
  test("entry with inputMode='blocks' round-trips correctly", async () => {
    const jsonPath = join(workDir, "blocks-entry.json");
    const entry: IndexEntry = {
      ...makeEntry("blk1", "2026-05-12T10:00:00.000Z"),
      inputMode: "blocks",
    };
    await atomicWrite(jsonPath, JSON.stringify([entry]));
    const result = await loadIndex(jsonPath);
    expect(result[0]?.inputMode).toBe("blocks");
  });

  test("entry with inputMode='html' round-trips correctly", async () => {
    const jsonPath = join(workDir, "html-entry.json");
    const entry: IndexEntry = {
      ...makeEntry("htm1", "2026-05-12T10:00:00.000Z"),
      inputMode: "html",
    };
    await atomicWrite(jsonPath, JSON.stringify([entry]));
    const result = await loadIndex(jsonPath);
    expect(result[0]?.inputMode).toBe("html");
  });

  test("old entry without inputMode: field is undefined (backward compat)", async () => {
    const jsonPath = join(workDir, "old-entry.json");
    const oldEntry = {
      id: "old99",
      title: "Old",
      kind: "plan",
      summary: null,
      tags: [],
      createdAt: "2026-05-11T10:00:00.000Z",
      filename: "old99.html",
      supersedes: null,
      supersededBy: null,
      gitBranch: null,
      gitCommit: null,
      contentSha256: "abc",
      projectSlug: "test-project",
      projectName: "Test Project",
      bodyText: "",
      // inputMode intentionally absent
    };
    await atomicWrite(jsonPath, JSON.stringify([oldEntry]));
    const result = await loadIndex(jsonPath);
    // inputMode is optional — should be undefined for old entries
    expect(result[0]?.inputMode).toBeUndefined();
  });

  test("patchEntry preserves inputMode field", () => {
    const entries: IndexEntry[] = [
      { ...makeEntry("abc", "2026-05-11T10:00:00.000Z"), inputMode: "blocks" },
    ];
    const result = patchEntry(entries, "abc", { supersededBy: "xyz" });
    expect(result[0]?.inputMode).toBe("blocks");
  });
});

// Unified diff parser — converts a unified patch string to a DiffEntry[].
// src/render/blocks/diff/parse-unified.ts

export type DiffLine = {
  kind: "context" | "add" | "remove";
  text: string; // raw text, no leading +/- prefix
  beforeLineNum: number | null; // 1-indexed line in "before" file, null for adds
  afterLineNum: number | null; // 1-indexed line in "after" file, null for removes
};

export type DiffEntry = DiffLine | { kind: "hunk-sep"; oldStart: number; newStart: number };

// Matches: @@ -<oldStart>[,<oldLines>] +<newStart>[,<newLines>] @@
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse a unified diff patch string into a DiffEntry[].
 * Returns null if no hunk header is found (caller falls back to plaintext).
 */
export function parseUnifiedDiff(patch: string): DiffEntry[] | null {
  const lines = patch.split("\n");
  const result: DiffEntry[] = [];
  let foundHunk = false;
  let firstHunk = true;

  // Counters for current hunk position
  let beforeLine = 0;
  let afterLine = 0;

  for (const line of lines) {
    // Skip file header lines (--- / +++ at the very top)
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      continue;
    }

    // Check for hunk header
    const hunkMatch = HUNK_HEADER.exec(line);
    if (hunkMatch !== null) {
      const oldStart = parseInt(hunkMatch[1] ?? "1", 10);
      const newStart = parseInt(hunkMatch[3] ?? "1", 10);

      if (!firstHunk) {
        // Emit hunk separator between hunks
        result.push({ kind: "hunk-sep", oldStart, newStart });
      }
      firstHunk = false;
      foundHunk = true;

      beforeLine = oldStart;
      afterLine = newStart;
      continue;
    }

    if (!foundHunk) {
      // Haven't seen a hunk header yet — skip pre-header lines
      continue;
    }

    // Skip "\ No newline at end of file" markers
    if (line.startsWith("\\")) {
      continue;
    }

    const prefix = line[0];
    const text = line.slice(1);

    if (prefix === " ") {
      // Context line — appears on both sides
      result.push({
        kind: "context",
        text,
        beforeLineNum: beforeLine,
        afterLineNum: afterLine,
      });
      beforeLine++;
      afterLine++;
    } else if (prefix === "-") {
      // Removed line — only in "before"
      result.push({
        kind: "remove",
        text,
        beforeLineNum: beforeLine,
        afterLineNum: null,
      });
      beforeLine++;
    } else if (prefix === "+") {
      // Added line — only in "after"
      result.push({
        kind: "add",
        text,
        beforeLineNum: null,
        afterLineNum: afterLine,
      });
      afterLine++;
    }
    // Any other prefix: skip (e.g. empty lines after hunk body)
  }

  if (!foundHunk) return null;
  return result;
}

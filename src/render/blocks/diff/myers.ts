// Myers O(ND) line-level diff algorithm.
// src/render/blocks/diff/myers.ts
//
// Re-implemented from scratch — no external dependencies.
// Reference: "An O(ND) Difference Algorithm and Its Variations" — Eugene W. Myers (1986).
//
// Implementation follows the standard "trace + backtrack" pattern from:
// https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/

import type { DiffLine } from "./parse-unified.ts";

export type { DiffLine };

/**
 * Split a string into lines, trimming a single trailing empty element when the
 * input ends with "\n" (so clean files don't produce a phantom blank final line).
 */
function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  // Trim trailing phantom empty line produced by a trailing newline
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

// ─── Myers forward pass ───────────────────────────────────────────────────────

/**
 * Run the Myers forward pass and return the trace (one v[] snapshot per d).
 * v[k + offset] = furthest row reached on diagonal k at this step.
 */
function myersTrace(a: string[], b: string[]): number[][] {
  const N = a.length;
  const M = b.length;
  const MAX = N + M;
  const offset = MAX;

  const v: number[] = Array.from({ length: 2 * MAX + 2 }, () => 0);
  v[offset + 1] = 0;

  const trace: number[][] = [];

  for (let d = 0; d <= MAX; d++) {
    for (let k = -d; k <= d; k += 2) {
      const ki = k + offset;
      const vKm1 = v[ki - 1] ?? 0;
      const vKp1 = v[ki + 1] ?? 0;

      let x: number;
      if (k === -d || (k !== d && vKm1 < vKp1)) {
        x = vKp1; // down: insert
      } else {
        x = vKm1 + 1; // right: delete
      }

      let y = x - k;

      // Follow the diagonal (matches)
      while (x < N && y < M && a[x] === b[y]) {
        x++;
        y++;
      }

      v[ki] = x;

      if (x >= N && y >= M) {
        trace.push(v.slice());
        return trace;
      }
    }

    trace.push(v.slice());
  }

  return trace;
}

// ─── Myers backtrack ──────────────────────────────────────────────────────────

type Edit =
  | { op: "keep"; aIdx: number; bIdx: number }
  | { op: "delete"; aIdx: number }
  | { op: "insert"; bIdx: number };

/**
 * Backtrack through the trace to produce the edit script.
 * Reconstructs the path from (N, M) back to (0, 0).
 */
function backtrack(a: string[], b: string[], trace: number[][]): Edit[] {
  const MAX = a.length + b.length;
  const offset = MAX;
  const edits: Edit[] = [];

  let x = a.length;
  let y = b.length;

  // Walk backwards through d steps
  for (let d = trace.length - 1; d > 0; d--) {
    const vPrev = trace[d - 1] ?? [];
    const k = x - y;
    const ki = k + offset;

    const vPrevKm1 = vPrev[ki - 1] ?? 0;
    const vPrevKp1 = vPrev[ki + 1] ?? 0;

    // Determine which diagonal we came from
    let prevK: number;
    if (k === -d || (k !== d && vPrevKm1 < vPrevKp1)) {
      prevK = k + 1; // came via down (insert)
    } else {
      prevK = k - 1; // came via right (delete)
    }

    const prevX = vPrev[prevK + offset] ?? 0;
    const prevY = prevX - prevK;

    // Retrace the snake (diagonal matches) from (prevX, prevY) to (x, y)
    // but skip the single edit step itself.
    // After the edit step, we were at:
    //   insert: (prevX, prevY + 1)
    //   delete: (prevX + 1, prevY)
    if (prevK === k + 1) {
      // insert: moved down, x stays same, y += 1
      const snakeX = prevX;
      // snake goes from (snakeX, prevY+1) to (x, y)
      for (let sx = x - 1; sx >= snakeX; sx--) {
        const sy = sx - k;
        edits.push({ op: "keep", aIdx: sx, bIdx: sy });
      }
      edits.push({ op: "insert", bIdx: prevY });
    } else {
      // delete: moved right, x += 1, y stays same
      const snakeX = prevX + 1;
      // snake goes from (snakeX, prevY) to (x, y)
      for (let sx = x - 1; sx >= snakeX; sx--) {
        const sy = sx - k;
        edits.push({ op: "keep", aIdx: sx, bIdx: sy });
      }
      edits.push({ op: "delete", aIdx: prevX });
    }

    x = prevX;
    y = prevY;
  }

  // Remaining snake at d=0: (0,0) to (x,y)
  for (let sx = x - 1; sx >= 0; sx--) {
    const sy = sx; // k=0 at the start
    edits.push({ op: "keep", aIdx: sx, bIdx: sy });
  }

  edits.reverse();
  return edits;
}

function myersDiff(a: string[], b: string[]): Edit[] {
  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return b.map((_, i) => ({ op: "insert" as const, bIdx: i }));
  if (b.length === 0) return a.map((_, i) => ({ op: "delete" as const, aIdx: i }));

  const trace = myersTrace(a, b);
  return backtrack(a, b, trace);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute a line-level diff between two text strings.
 * Returns a flat DiffLine[] with 1-indexed line numbers per side.
 * No hunk-sep entries — single contiguous diff.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const aLines = splitLines(before);
  const bLines = splitLines(after);

  const edits = myersDiff(aLines, bLines);

  let beforeLine = 1;
  let afterLine = 1;

  return edits.map((edit): DiffLine => {
    switch (edit.op) {
      case "keep": {
        const text = aLines[edit.aIdx] ?? "";
        const entry: DiffLine = {
          kind: "context",
          text,
          beforeLineNum: beforeLine,
          afterLineNum: afterLine,
        };
        beforeLine++;
        afterLine++;
        return entry;
      }
      case "delete": {
        const text = aLines[edit.aIdx] ?? "";
        const entry: DiffLine = {
          kind: "remove",
          text,
          beforeLineNum: beforeLine,
          afterLineNum: null,
        };
        beforeLine++;
        return entry;
      }
      case "insert": {
        const text = bLines[edit.bIdx] ?? "";
        const entry: DiffLine = {
          kind: "add",
          text,
          beforeLineNum: null,
          afterLineNum: afterLine,
        };
        afterLine++;
        return entry;
      }
    }
  });
}

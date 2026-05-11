// Reads and writes the per-project and global index.json cache files.

import { readFile } from "node:fs/promises";
import { atomicWrite } from "./write.ts";

export interface IndexEntry {
  id: string;
  title: string;
  kind: string;
  summary: string | null;
  tags: string[];
  createdAt: string;
  filename: string;
  supersedes: string | null;
  supersededBy: string | null;
  gitBranch: string | null;
  gitCommit: string | null;
  contentSha256: string;
  projectSlug: string;
  projectName: string;
}

export async function loadIndex(jsonPath: string): Promise<IndexEntry[]> {
  let raw: string;
  try {
    raw = await readFile(jsonPath, "utf8");
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") return [];
    throw err;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`index.json at ${jsonPath} is not an array`);
  }
  return parsed as IndexEntry[];
}

export async function writeIndex(jsonPath: string, entries: IndexEntry[]): Promise<void> {
  await atomicWrite(jsonPath, JSON.stringify(entries, null, 2));
}

export function appendEntry(entries: IndexEntry[], entry: IndexEntry): IndexEntry[] {
  const next = [...entries, entry];
  return next.toSorted((a: IndexEntry, b: IndexEntry) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return tb - ta;
  });
}

export function patchEntry(
  entries: IndexEntry[],
  id: string,
  patch: Partial<IndexEntry>,
): IndexEntry[] {
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return entries;
  const updated = entries.map((e, i) => (i === idx ? { ...e, ...patch } : e));
  return updated;
}

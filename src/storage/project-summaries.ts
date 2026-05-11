// Shared utility: groups a flat list of IndexEntry records into per-project summaries.
// Used by both cesium_publish and cesium_ask when regenerating the global index.

import type { IndexEntry } from "./index-cache.ts";
import { summarizeProject, type ProjectSummary } from "./index-gen.ts";

export type { ProjectSummary };

export function buildProjectSummaries(entries: IndexEntry[]): ProjectSummary[] {
  const bySlug = new Map<string, { name: string; entries: IndexEntry[] }>();
  for (const e of entries) {
    const group = bySlug.get(e.projectSlug) ?? { name: e.projectName, entries: [] };
    group.entries.push(e);
    bySlug.set(e.projectSlug, group);
  }
  return [...bySlug.entries()].map(([slug, { name, entries: es }]) =>
    summarizeProject({ slug, name, entries: es }),
  );
}

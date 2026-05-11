// Atomic file write: write to a .tmp file, then rename to the final path.

import { mkdir, open, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

export async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  const rand = randomBytes(6).toString("hex");
  const tmpPath = `${filePath}.tmp.${rand}`;
  const fh = await open(tmpPath, "w");
  try {
    await fh.writeFile(contents, "utf8");
    await fh.datasync().catch(() => {
      // best-effort fsync
    });
  } finally {
    await fh.close();
  }
  await rename(tmpPath, filePath);
}

export interface EmbeddedMetadata {
  [key: string]: unknown;
}

const META_RE =
  /<script\s[^>]*type="application\/json"[^>]*id="cesium-meta"[^>]*>([\s\S]*?)<\/script>/i;

export function readEmbeddedMetadata(html: string): EmbeddedMetadata | null {
  const match = META_RE.exec(html);
  if (!match) return null;
  const raw = match[1];
  if (raw === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as EmbeddedMetadata;
  } catch {
    return null;
  }
}

export async function patchEmbeddedMetadata(
  filePath: string,
  patch: Partial<EmbeddedMetadata>,
): Promise<void> {
  const content = await Bun.file(filePath).text();
  const match = META_RE.exec(content);
  if (!match) throw new Error(`No cesium-meta script block found in: ${filePath}`);

  const raw = match[1];
  if (raw === undefined) throw new Error(`Empty cesium-meta script block in: ${filePath}`);

  let existing: unknown;
  try {
    existing = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Malformed cesium-meta JSON in: ${filePath}`, { cause: err });
  }

  if (existing === null || typeof existing !== "object" || Array.isArray(existing)) {
    throw new Error(`cesium-meta JSON is not an object in: ${filePath}`);
  }

  const merged: EmbeddedMetadata = { ...(existing as EmbeddedMetadata), ...patch };
  const newJson = JSON.stringify(merged, null, 2).replace(/<\/script>/gi, "<\\/script>");

  const fullMatch = match[0];
  const newBlock = fullMatch.replace(raw, newJson);
  const newContent = content.replace(fullMatch, newBlock);

  await atomicWrite(filePath, newContent);
}

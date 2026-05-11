// Derives the state directory, project slug, and artifact filenames.

import { createHash } from "node:crypto";
import { basename, join } from "node:path";

export interface ProjectIdentity {
  slug: string;
  name: string;
  cwd: string;
  worktree: string | null;
  gitRemote: string | null;
}

export interface DeriveIdentityArgs {
  cwd: string;
  gitRemote: string | null;
  worktree?: string | null;
}

function sanitizeSlug(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

function parseGitRemote(remote: string): { slug: string; name: string } | null {
  let normalized = remote.trim();

  // SSH: git@github.com:cfb/cesium.git
  const sshMatch = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(normalized);
  if (sshMatch) {
    const host = sshMatch[1] ?? "";
    const path = sshMatch[2] ?? "";
    const pathParts = path.split("/").filter(Boolean);
    const hostSlug = host.replace(/\./g, "-");
    const slug = sanitizeSlug(`${hostSlug}-${pathParts.join("-")}`);
    const name =
      pathParts.length >= 2
        ? `${pathParts[pathParts.length - 2]}/${pathParts[pathParts.length - 1]}`
        : (pathParts[0] ?? host);
    return { slug, name };
  }

  // HTTPS / other URL
  try {
    if (!normalized.includes("://")) normalized = `https://${normalized}`;
    const url = new URL(normalized);
    const host = url.hostname;
    const pathRaw = url.pathname.replace(/\.git$/, "").replace(/^\//, "");
    const pathParts = pathRaw.split("/").filter(Boolean);
    const hostSlug = host.replace(/\./g, "-");
    const slug = sanitizeSlug(`${hostSlug}-${pathParts.join("-")}`);
    const name =
      pathParts.length >= 2
        ? `${pathParts[pathParts.length - 2]}/${pathParts[pathParts.length - 1]}`
        : (pathParts[0] ?? host);
    return { slug, name };
  } catch {
    return null;
  }
}

export function deriveProjectIdentity(args: DeriveIdentityArgs): ProjectIdentity {
  const { cwd, gitRemote, worktree = null } = args;

  if (gitRemote) {
    const parsed = parseGitRemote(gitRemote);
    if (parsed) {
      return {
        slug: parsed.slug,
        name: parsed.name,
        cwd,
        worktree: worktree ?? null,
        gitRemote,
      };
    }
  }

  // Fallback: basename + 6-char hex hash of absolute cwd
  const base = basename(cwd) || "project";
  const hash = createHash("sha256").update(cwd).digest("hex").slice(0, 6);
  const slug = sanitizeSlug(`${base}-${hash}`);

  return {
    slug,
    name: base,
    cwd,
    worktree: worktree ?? null,
    gitRemote,
  };
}

export function slugifyTitle(title: string, maxLen = 60): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const result = slug.slice(0, maxLen).replace(/-+$/, "");
  return result || "untitled";
}

export interface ArtifactFilenameArgs {
  title: string;
  id: string;
  createdAt: Date;
}

export function artifactFilename(args: ArtifactFilenameArgs): string {
  const { title, id, createdAt } = args;
  const iso = createdAt
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-");
  const slug = slugifyTitle(title);
  return `${iso}__${slug}__${id}.html`;
}

export interface ArtifactPaths {
  stateDir: string;
  projectDir: string;
  artifactsDir: string;
  artifactPath: string;
  projectIndexPath: string;
  projectIndexJsonPath: string;
  globalIndexPath: string;
  globalIndexJsonPath: string;
  fileUrl: string;
  serverPath: string;
}

export interface PathsForArgs {
  stateDir: string;
  projectSlug: string;
  filename: string;
}

export function pathsFor(args: PathsForArgs): ArtifactPaths {
  const { stateDir, projectSlug, filename } = args;
  const projectDir = join(stateDir, "projects", projectSlug);
  const artifactsDir = join(projectDir, "artifacts");
  const artifactPath = join(artifactsDir, filename);
  const serverPath = `/projects/${projectSlug}/artifacts/${filename}`;

  return {
    stateDir,
    projectDir,
    artifactsDir,
    artifactPath,
    projectIndexPath: join(projectDir, "index.html"),
    projectIndexJsonPath: join(projectDir, "index.json"),
    globalIndexPath: join(stateDir, "index.html"),
    globalIndexJsonPath: join(stateDir, "index.json"),
    fileUrl: `file://${artifactPath}`,
    serverPath,
  };
}

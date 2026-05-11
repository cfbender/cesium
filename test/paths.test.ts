import { describe, expect, test } from "bun:test";
import {
  artifactFilename,
  deriveProjectIdentity,
  pathsFor,
  slugifyTitle,
} from "../src/storage/paths.ts";
import { join } from "node:path";

describe("deriveProjectIdentity", () => {
  test("github HTTPS remote", () => {
    const id = deriveProjectIdentity({
      cwd: "/Users/cfb/code/cesium",
      gitRemote: "https://github.com/cfb/cesium.git",
    });
    expect(id.slug).toBe("github-com-cfb-cesium");
    expect(id.name).toBe("cfb/cesium");
    expect(id.cwd).toBe("/Users/cfb/code/cesium");
    expect(id.gitRemote).toBe("https://github.com/cfb/cesium.git");
    expect(id.worktree).toBeNull();
  });

  test("github SSH remote", () => {
    const id = deriveProjectIdentity({
      cwd: "/Users/cfb/code/cesium",
      gitRemote: "git@github.com:cfb/cesium.git",
    });
    expect(id.slug).toBe("github-com-cfb-cesium");
    expect(id.name).toBe("cfb/cesium");
  });

  test("gitlab subgroup remote", () => {
    const id = deriveProjectIdentity({
      cwd: "/Users/cfb/code/project",
      gitRemote: "https://gitlab.com/group/sub/repo.git",
    });
    expect(id.slug).toBe("gitlab-com-group-sub-repo");
    expect(id.name).toBe("sub/repo");
  });

  test("no remote — basename + hash", () => {
    const cwd = "/Users/cfb/code/myproject";
    const id = deriveProjectIdentity({ cwd, gitRemote: null });
    expect(id.slug).toMatch(/^myproject-[a-f0-9]{6}$/);
    expect(id.name).toBe("myproject");
    expect(id.gitRemote).toBeNull();
  });

  test("no remote — same cwd produces same hash", () => {
    const cwd = "/Users/cfb/code/myproject";
    const a = deriveProjectIdentity({ cwd, gitRemote: null });
    const b = deriveProjectIdentity({ cwd, gitRemote: null });
    expect(a.slug).toBe(b.slug);
  });

  test("no remote — different cwd produces different hash", () => {
    const a = deriveProjectIdentity({ cwd: "/Users/cfb/code/alpha", gitRemote: null });
    const b = deriveProjectIdentity({ cwd: "/Users/cfb/code/beta", gitRemote: null });
    expect(a.slug).not.toBe(b.slug);
  });

  test("worktree passed through", () => {
    const id = deriveProjectIdentity({
      cwd: "/Users/cfb/code/cesium",
      gitRemote: "https://github.com/cfb/cesium.git",
      worktree: "/Users/cfb/worktrees/feature",
    });
    expect(id.worktree).toBe("/Users/cfb/worktrees/feature");
  });

  test("slug is [a-z0-9-] only", () => {
    const id = deriveProjectIdentity({
      cwd: "/code/project",
      gitRemote: "https://github.com/cfb/cesium.git",
    });
    expect(id.slug).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("slugifyTitle", () => {
  test("basic lowercase hyphenation", () => {
    expect(slugifyTitle("Auth Design v2")).toBe("auth-design-v2");
  });

  test("strips trailing/leading special chars", () => {
    expect(slugifyTitle("  !! Auth Design !!  ")).toBe("auth-design");
  });

  test("strips punctuation", () => {
    expect(slugifyTitle("Auth design v2!")).toBe("auth-design-v2");
  });

  test("unicode letters stripped to hyphens", () => {
    const slug = slugifyTitle("Ärger über Ü");
    expect(slug).toMatch(/^[a-z0-9-]*$/);
  });

  test("all special chars — returns untitled", () => {
    expect(slugifyTitle("!!!")).toBe("untitled");
    expect(slugifyTitle("   ")).toBe("untitled");
  });

  test("truncates to maxLen", () => {
    const long = "a".repeat(100);
    expect(slugifyTitle(long, 60).length).toBeLessThanOrEqual(60);
  });

  test("default maxLen is 60", () => {
    const long = "word ".repeat(20);
    expect(slugifyTitle(long).length).toBeLessThanOrEqual(60);
  });

  test("no trailing dash after truncation", () => {
    const title = "auth design plan review strategy";
    const slug = slugifyTitle(title, 15);
    expect(slug).not.toMatch(/-$/);
  });
});

describe("artifactFilename", () => {
  test("produces sortable timestamp without colons", () => {
    const date = new Date("2026-05-11T14:22:09Z");
    const filename = artifactFilename({ title: "Auth design", id: "a7K9pQ", createdAt: date });
    expect(filename).toBe("2026-05-11T14-22-09Z__auth-design__a7K9pQ.html");
  });

  test("no colons in filename", () => {
    const filename = artifactFilename({
      title: "Test",
      id: "abc123",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(filename).not.toContain(":");
  });

  test("ends with .html", () => {
    const filename = artifactFilename({
      title: "Plan",
      id: "xyz789",
      createdAt: new Date(),
    });
    expect(filename).toMatch(/\.html$/);
  });

  test("contains double-underscore separators", () => {
    const filename = artifactFilename({
      title: "My Plan",
      id: "abc123",
      createdAt: new Date("2026-05-11T10:00:00Z"),
    });
    const parts = filename.split("__");
    expect(parts).toHaveLength(3);
    expect(parts[2]).toBe("abc123.html");
  });
});

describe("pathsFor", () => {
  test("correct structure", () => {
    const paths = pathsFor({
      stateDir: "/state",
      projectSlug: "github-com-cfb-cesium",
      filename: "2026-05-11T14-22-09Z__plan__abc123.html",
    });
    expect(paths.projectDir).toBe(join("/state", "projects", "github-com-cfb-cesium"));
    expect(paths.artifactsDir).toBe(
      join("/state", "projects", "github-com-cfb-cesium", "artifacts"),
    );
    expect(paths.artifactPath).toBe(
      join(
        "/state",
        "projects",
        "github-com-cfb-cesium",
        "artifacts",
        "2026-05-11T14-22-09Z__plan__abc123.html",
      ),
    );
    expect(paths.fileUrl).toMatch(/^file:\/\//);
    expect(paths.serverPath).toBe(
      "/projects/github-com-cfb-cesium/artifacts/2026-05-11T14-22-09Z__plan__abc123.html",
    );
    expect(paths.globalIndexPath).toBe(join("/state", "index.html"));
    expect(paths.globalIndexJsonPath).toBe(join("/state", "index.json"));
    expect(paths.projectIndexPath).toBe(
      join("/state", "projects", "github-com-cfb-cesium", "index.html"),
    );
    expect(paths.projectIndexJsonPath).toBe(
      join("/state", "projects", "github-com-cfb-cesium", "index.json"),
    );
  });

  test("stateDir is propagated", () => {
    const paths = pathsFor({
      stateDir: "/custom/state",
      projectSlug: "myslug",
      filename: "foo.html",
    });
    expect(paths.stateDir).toBe("/custom/state");
  });
});

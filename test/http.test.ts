import { test, expect, beforeEach, afterEach, describe } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { startServer } from "../src/server/http.ts";
import type { ServerHandle } from "../src/server/http.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let workDir: string;
let handle: ServerHandle | null = null;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "cesium-http-"));
});

afterEach(async () => {
  if (handle !== null) {
    await handle.stop();
    handle = null;
  }
  rmSync(workDir, { recursive: true, force: true });
});

// Send a raw HTTP GET request bypassing URL normalization, for traversal testing.
function rawGet(port: number, rawPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const sock = createConnection({ port, host: "127.0.0.1" }, () => {
      sock.write(`GET ${rawPath} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`);
    });
    let data = "";
    sock.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });
    sock.on("end", () => {
      const firstLine = data.split("\r\n")[0] ?? "";
      const statusMatch = /HTTP\/1\.\d (\d+)/.exec(firstLine);
      const status = statusMatch ? parseInt(statusMatch[1] ?? "0", 10) : 0;
      const bodyStart = data.indexOf("\r\n\r\n");
      const body = bodyStart >= 0 ? data.slice(bodyStart + 4) : "";
      resolve({ status, body });
    });
    sock.on("error", reject);
  });
}

async function bind(): Promise<ServerHandle> {
  handle = await startServer({ stateDir: workDir, port: 0 });
  return handle;
}

async function get(url: string): Promise<Response> {
  return fetch(url);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("startServer", () => {
  test("GET / → 404 when no index.html present", async () => {
    const h = await bind();
    const res = await get(`${h.url}/`);
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toContain("404");
  });

  test("GET / → 200 with correct Content-Type when index.html present", async () => {
    writeFileSync(join(workDir, "index.html"), "<h1>hello cesium</h1>");
    const h = await bind();
    const res = await get(`${h.url}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("hello cesium");
  });

  test("GET /foo/bar.json → 200 with application/json Content-Type", async () => {
    const subDir = join(workDir, "foo");
    mkdirSync(subDir);
    writeFileSync(join(subDir, "bar.json"), JSON.stringify({ ok: true }));
    const h = await bind();
    const res = await get(`${h.url}/foo/bar.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    const body = await res.json();
    expect((body as Record<string, unknown>)["ok"]).toBe(true);
  });

  test("path traversal: raw HTTP GET /../../etc/passwd → 404 (Bun normalizes path before handler)", async () => {
    // Bun.serve normalizes /../.. in the raw HTTP request path before the fetch handler
    // sees it (req.url becomes /etc/passwd). So the traversal guard resolves the path inside
    // stateDir (stateDir/etc/passwd), which doesn't exist → 404. The guard itself is correct
    // defense-in-depth for non-Bun HTTP stacks or future changes.
    const h = await bind();
    const res = await rawGet(h.port, "/../../etc/passwd");
    // Bun normalizes → /etc/passwd → resolves inside stateDir → file missing → 404
    expect(res.status).toBe(404);
  });

  test("directory request with trailing slash: serves index.html", async () => {
    const subDir = join(workDir, "sub");
    mkdirSync(subDir);
    writeFileSync(join(subDir, "index.html"), "<h1>sub index</h1>");
    const h = await bind();
    const res = await get(`${h.url}/sub/`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("sub index");
  });

  test("directory request without trailing slash: serves index.html directly", async () => {
    // Choice: serve the directory's index.html directly (no redirect).
    // This keeps the server simple and avoids redirect loops for artifact links.
    const subDir = join(workDir, "sub");
    mkdirSync(subDir);
    writeFileSync(join(subDir, "index.html"), "<h1>sub no-slash</h1>");
    const h = await bind();
    const res = await get(`${h.url}/sub`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("sub no-slash");
  });

  test("onRequest callback fires on each request", async () => {
    writeFileSync(join(workDir, "index.html"), "<h1>track</h1>");
    const h = await bind();
    let callCount = 0;
    h.onRequest(() => {
      callCount++;
    });
    await get(`${h.url}/`);
    await get(`${h.url}/`);
    expect(callCount).toBe(2);
  });

  test(".svg files served with image/svg+xml Content-Type", async () => {
    writeFileSync(
      join(workDir, "icon.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
    );
    const h = await bind();
    const res = await get(`${h.url}/icon.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
  });

  test("404 for nonexistent path returns the cesium 404 page", async () => {
    const h = await bind();
    const res = await get(`${h.url}/does/not/exist.html`);
    expect(res.status).toBe(404);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("text/html");
    const body = await res.text();
    // The 404 page contains a 404 heading
    expect(body).toContain("404");
    // And it's minimal HTML
    expect(body.toLowerCase()).toContain("<!doctype html>");
  });

  test("multiple onRequest listeners: all fire", async () => {
    writeFileSync(join(workDir, "index.html"), "<p>x</p>");
    const h = await bind();
    let a = 0;
    let b = 0;
    h.onRequest(() => {
      a++;
    });
    h.onRequest(() => {
      b++;
    });
    await get(`${h.url}/`);
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});

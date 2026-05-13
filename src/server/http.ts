// Bun HTTP server bound to 127.0.0.1 (default), serving the cesium state directory.
//
// Routing is owned by a Hono app exposed on the returned ServerHandle. Callers
// (e.g. lifecycle.ts) mount sub-apps for /api/* and /favicon.ico via
// `handle.app.route("/", subApp)`. Any path that does not match a registered
// route falls through to the static file handler installed here via
// `app.notFound` — this preserves the cesium-specific behavior (custom 404 page,
// 1MB streaming threshold, MIME table) without forcing callers to think about
// registration order.

import { resolve, extname } from "node:path";
import { readFile } from "node:fs/promises";
import { Hono } from "hono";

export interface ServerHandle {
  port: number;
  url: string; // "http://127.0.0.1:<port>"
  /** Hono app — register routes via `handle.app.route(...)` before requests arrive. */
  app: Hono;
  stop(): Promise<void>;
  /** Register an idle-tracker callback fired on every request. */
  onRequest(handler: () => void): void;
}

export interface StartServerArgs {
  stateDir: string; // absolute, served as the root
  port: number; // exact port to bind; lifecycle handles conflict scanning
  hostname?: string; // default "127.0.0.1"
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>404</title>
<style>
  body{font-family:system-ui,sans-serif;background:#faf9f5;color:#141413;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .box{text-align:center}h1{font-size:2rem;margin:0 0 .5rem}p{color:#87867f;margin:0}
</style>
</head>
<body><div class="box"><h1>404</h1><p>not found</p></div></body>
</html>`;

const FORBIDDEN_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>403</title>
<style>
  body{font-family:system-ui,sans-serif;background:#faf9f5;color:#141413;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .box{text-align:center}h1{font-size:2rem;margin:0 0 .5rem}p{color:#87867f;margin:0}
</style>
</head>
<body><div class="box"><h1>403</h1><p>forbidden</p></div></body>
</html>`;

const ONE_MB = 1024 * 1024;

function mimeFor(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function htmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Static file handler: resolves the request path under stateDir, enforces
// traversal containment, falls back to index.html for directories, streams
// files >= 1MB, and returns the cesium 404 page on miss.
async function serveStatic(req: Request, stateDirResolved: string): Promise<Response> {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(req.url);
  let reqPath: string;
  try {
    reqPath = decodeURIComponent(url.pathname);
  } catch {
    return htmlResponse(NOT_FOUND_HTML, 404);
  }

  const joined = resolve(stateDirResolved, "." + reqPath);

  // Path traversal defense: resolved path must be rooted at stateDir
  if (!joined.startsWith(stateDirResolved + "/") && joined !== stateDirResolved) {
    return htmlResponse(FORBIDDEN_HTML, 403);
  }

  const filePath = joined;
  const trailingSlash = reqPath.endsWith("/");
  const indexPath = filePath.endsWith("/") ? filePath + "index.html" : filePath + "/index.html";

  let fileToServe = filePath;
  let isDir = false;
  if (trailingSlash || extname(filePath) === "") {
    isDir = true;
    fileToServe = filePath.endsWith("/") ? filePath + "index.html" : filePath + "/index.html";
  }

  const bunFile = Bun.file(fileToServe);
  let exists = await bunFile.exists();

  if (!exists && !isDir) {
    // Try as directory index (e.g. /sub → /sub/index.html)
    fileToServe = indexPath;
    exists = await Bun.file(fileToServe).exists();
    if (!exists) return htmlResponse(NOT_FOUND_HTML, 404);
  } else if (!exists) {
    return htmlResponse(NOT_FOUND_HTML, 404);
  }

  const contentType = mimeFor(fileToServe);
  const finalFile = Bun.file(fileToServe);
  const size = finalFile.size;

  // Large files: stream; small files: read fully.
  if (size >= ONE_MB) {
    return new Response(finalFile.stream(), {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  }

  const buf = await readFile(fileToServe);
  return new Response(buf, { status: 200, headers: { "Content-Type": contentType } });
}

export async function startServer(args: StartServerArgs): Promise<ServerHandle> {
  const { stateDir, port, hostname = "127.0.0.1" } = args;
  const stateDirResolved = resolve(stateDir);
  const requestHandlers: Array<() => void> = [];

  const app = new Hono();

  // Idle-tracker middleware: fires registered callbacks on every request before
  // dispatching to routes. Used by lifecycle.ts to reset the idle-shutdown timer.
  app.use("*", async (_c, next) => {
    for (const h of requestHandlers) {
      h();
    }
    await next();
  });

  // Anything that doesn't match a registered route falls through to static
  // file serving rooted at stateDir.
  app.notFound((c) => serveStatic(c.req.raw, stateDirResolved));

  const server = Bun.serve({
    hostname,
    port,
    fetch: app.fetch,
  });

  const actualPort = server.port;
  if (actualPort === undefined) {
    await server.stop();
    throw new Error("cesium: server.port is undefined after Bun.serve (unexpected)");
  }
  const serverUrl = `http://${hostname}:${actualPort}`;

  return {
    port: actualPort,
    url: serverUrl,
    app,
    stop: async () => {
      await server.stop();
    },
    onRequest: (handler: () => void) => {
      requestHandlers.push(handler);
    },
  };
}

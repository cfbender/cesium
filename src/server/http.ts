// Bun HTTP server bound to 127.0.0.1 (default), serving the cesium state directory.

import { resolve, extname } from "node:path";
import { readFile } from "node:fs/promises";

export interface ServerHandle {
  port: number;
  url: string; // "http://127.0.0.1:<port>"
  stop(): Promise<void>;
  onRequest(handler: () => void): void; // for idle-tracking; lifecycle attaches a callback
  /** Register a pre-static handler. Returns a Response to short-circuit, or undefined to fall through. */
  addHandler(handler: (req: Request) => Promise<Response | undefined>): void;
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

function mimeFor(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

export async function startServer(args: StartServerArgs): Promise<ServerHandle> {
  const { stateDir, port, hostname = "127.0.0.1" } = args;
  const stateDirResolved = resolve(stateDir);
  const requestHandlers: Array<() => void> = [];
  const preHandlers: Array<(req: Request) => Promise<Response | undefined>> = [];

  const server = Bun.serve({
    hostname,
    port,
    async fetch(req) {
      // Notify idle tracker
      for (const h of requestHandlers) {
        h();
      }

      // Run pre-static handlers (e.g. API routes) before serving static files
      for (const handler of preHandlers) {
        // eslint-disable-next-line no-await-in-loop -- middleware chain: first non-undefined wins, must run sequentially
        const result = await handler(req);
        if (result !== undefined) {
          return result;
        }
      }

      if (req.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      const url = new URL(req.url);
      // Decode and normalize the request path
      let reqPath: string;
      try {
        reqPath = decodeURIComponent(url.pathname);
      } catch {
        return new Response(NOT_FOUND_HTML, {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Resolve the absolute path under stateDir
      // Use resolve with stateDir as root to prevent traversal
      const joined = resolve(stateDirResolved, "." + reqPath);

      // Path traversal defense: resolved path must be rooted at stateDir
      if (!joined.startsWith(stateDirResolved + "/") && joined !== stateDirResolved) {
        return new Response(FORBIDDEN_HTML, {
          status: 403,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Determine final file path: if directory, try index.html
      let filePath = joined;
      const trailingSlash = reqPath.endsWith("/");

      // Check if it's a directory by trying index.html
      const indexPath = filePath.endsWith("/") ? filePath + "index.html" : filePath + "/index.html";

      // Try as-is first, then as directory index
      let fileToServe = filePath;
      let isDir = false;

      // If path has no extension or trailing slash, it might be a directory
      if (trailingSlash || extname(filePath) === "") {
        isDir = true;
        fileToServe = filePath.endsWith("/") ? filePath + "index.html" : filePath + "/index.html";
      }

      const bunFile = Bun.file(fileToServe);
      let exists = await bunFile.exists();

      if (!exists && !isDir) {
        // Try as directory index (e.g. /sub → /sub/index.html)
        fileToServe = indexPath;
        const bunFileIdx = Bun.file(fileToServe);
        exists = await bunFileIdx.exists();
        if (!exists) {
          return new Response(NOT_FOUND_HTML, {
            status: 404,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      } else if (!exists) {
        return new Response(NOT_FOUND_HTML, {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      const contentType = mimeFor(fileToServe);
      const finalFile = Bun.file(fileToServe);
      const size = finalFile.size;

      // Large files (>= 1MB): stream; small files: read fully
      const ONE_MB = 1024 * 1024;
      if (size >= ONE_MB) {
        return new Response(finalFile.stream(), {
          status: 200,
          headers: { "Content-Type": contentType },
        });
      }

      const buf = await readFile(fileToServe);
      return new Response(buf, {
        status: 200,
        headers: { "Content-Type": contentType },
      });
    },
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
    stop: async () => {
      await server.stop();
    },
    onRequest: (handler: () => void) => {
      requestHandlers.push(handler);
    },
    addHandler: (handler: (req: Request) => Promise<Response | undefined>) => {
      preHandlers.push(handler);
    },
  };
}

// Favicon shim handler — serves the cesium favicon at /favicon.ico (the legacy
// path browsers request automatically) by returning the in-memory SVG bytes
// with image/svg+xml content type. All evergreen browsers accept SVG favicons
// regardless of the URL extension.
//
// The static server already serves /favicon.svg from <stateDir>/favicon.svg
// (written by writeFaviconSvg on every publish). This shim covers the .ico
// fallback so users don't see a 404 in DevTools.

import { Hono } from "hono";
import { FAVICON_SVG } from "../render/favicon.ts";

export function createFaviconApp(): Hono {
  const app = new Hono();
  app.on(["GET", "HEAD"], "/favicon.ico", (c) => {
    c.header("Cache-Control", "public, max-age=86400");
    return c.body(FAVICON_SVG, 200, { "Content-Type": "image/svg+xml; charset=utf-8" });
  });
  return app;
}

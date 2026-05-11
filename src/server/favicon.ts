// Favicon shim handler — serves the cesium favicon at /favicon.ico (the legacy
// path browsers request automatically) by returning the in-memory SVG bytes
// with image/svg+xml content type. All evergreen browsers accept SVG favicons
// regardless of the URL extension.
//
// The static server already serves /favicon.svg from <stateDir>/favicon.svg
// (written by writeFaviconSvg on every publish). This shim covers the .ico
// fallback so users don't see a 404 in DevTools.

import { FAVICON_SVG } from "../render/favicon.ts";

const SVG_RESPONSE_HEADERS: Record<string, string> = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=86400",
};

export function createFaviconHandler(): (req: Request) => Promise<Response | undefined> {
  return async (req: Request): Promise<Response | undefined> => {
    const url = new URL(req.url);
    if (url.pathname !== "/favicon.ico") {
      return undefined;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return undefined;
    }
    return new Response(FAVICON_SVG, { status: 200, headers: SVG_RESPONSE_HEADERS });
  };
}

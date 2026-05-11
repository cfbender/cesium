// Writes favicon.svg to the state directory.
//
// Mirrors theme-write.ts: produces a single static asset alongside theme.css
// that artifact pages and index pages reference via relative <link rel="icon">.
// The cesium HTTP server serves it automatically because the state dir is the
// server's static root.

import { join } from "node:path";
import { FAVICON_SVG } from "../render/favicon.ts";
import { atomicWrite } from "./write.ts";

/** Returns the absolute path to favicon.svg in the given stateDir. */
export function faviconSvgPath(stateDir: string): string {
  return join(stateDir, "favicon.svg");
}

/** Writes <stateDir>/favicon.svg. Atomic. Returns the absolute path.
 *  Idempotent — content is theme-independent so writing twice is a no-op. */
export async function writeFaviconSvg(stateDir: string): Promise<string> {
  const path = faviconSvgPath(stateDir);
  await atomicWrite(path, FAVICON_SVG);
  return path;
}

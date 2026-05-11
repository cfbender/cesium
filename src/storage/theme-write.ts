// Writes theme.css to the state directory for dynamic theme support.

import { join } from "node:path";
import { themeTokensCss } from "../render/theme.ts";
import type { ThemeTokens } from "../render/theme.ts";
import { atomicWrite } from "./write.ts";

/** Returns the absolute path to the theme.css file in the given stateDir. */
export function themeCssPath(stateDir: string): string {
  return join(stateDir, "theme.css");
}

/** Writes <stateDir>/theme.css with token definitions only (no framework rules).
 *  Atomic. Returns the absolute path. */
export async function writeThemeCss(stateDir: string, theme: ThemeTokens): Promise<string> {
  const path = themeCssPath(stateDir);
  await atomicWrite(path, themeTokensCss(theme) + "\n");
  return path;
}

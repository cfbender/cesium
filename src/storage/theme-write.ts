// Writes theme.css to the state directory for dynamic theme support.
//
// Produces the same content as `assets.ts:ensureThemeCss` — tokens + framework
// rules. The two writers were split during the v1 design (when theme.css held
// tokens only and framework CSS was inlined into every artifact) and were never
// re-unified after the phase 1 refactor promoted theme.css to carry the full
// framework. Keeping them aligned is now an invariant: if they disagree,
// `cesium theme apply` will clobber the CSS that the server / publish flow
// just wrote, and artifacts will render unstyled.

import { join } from "node:path";
import { themeTokensCss, frameworkRulesCss } from "../render/theme.ts";
import type { ThemeTokens } from "../render/theme.ts";
import { atomicWrite } from "./write.ts";

/** Returns the absolute path to the theme.css file in the given stateDir. */
export function themeCssPath(stateDir: string): string {
  return join(stateDir, "theme.css");
}

/** Returns the full theme.css content (tokens + framework rules) for a theme.
 *  Must stay byte-identical to `assets.ts:buildCss` — see module docstring. */
export function buildThemeCss(theme: ThemeTokens): string {
  return themeTokensCss(theme) + "\n" + frameworkRulesCss();
}

/** Writes <stateDir>/theme.css with the full framework CSS (tokens + rules).
 *  Atomic. Returns the absolute path. */
export async function writeThemeCss(stateDir: string, theme: ThemeTokens): Promise<string> {
  const path = themeCssPath(stateDir);
  await atomicWrite(path, buildThemeCss(theme));
  return path;
}

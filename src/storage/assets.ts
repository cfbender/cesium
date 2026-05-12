// Materializes /theme.css in the state directory, atomically and idempotently.

import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  frameworkRulesCss,
  themeTokensCss,
  defaultTheme,
  type ThemeTokens,
} from "../render/theme.ts";
import { atomicWrite } from "./write.ts";
import { readFile } from "node:fs/promises";

/** Per-theme CSS cache: built CSS string keyed by theme content hash. */
const cssCache = new Map<string, string>();

/** Returns a stable cache key for a theme (hash of its JSON representation). */
function themeKey(theme: ThemeTokens): string {
  return createHash("sha256").update(JSON.stringify(theme)).digest("hex");
}

/** Build the full theme.css string for a given theme (tokens + framework rules). */
function buildCss(theme: ThemeTokens): string {
  const key = themeKey(theme);
  const cached = cssCache.get(key);
  if (cached !== undefined) return cached;
  const css = themeTokensCss(theme) + "\n" + frameworkRulesCss();
  cssCache.set(key, css);
  return css;
}

/** Returns the absolute path to theme.css in stateDir. */
export function themeCssAssetPath(stateDir: string): string {
  return join(stateDir, "theme.css");
}

/**
 * Writes <stateDir>/theme.css with the full framework CSS (tokens + rules)
 * for the given theme, iff the on-disk file is missing or its content hash
 * differs from the expected content.  Idempotent and self-healing on plugin
 * upgrade or theme change.
 *
 * When called without a theme argument, falls back to defaultTheme() so
 * existing call sites remain valid.
 */
export async function ensureThemeCss(
  stateDir: string,
  theme: ThemeTokens = defaultTheme(),
): Promise<void> {
  const dest = themeCssAssetPath(stateDir);
  const bundledCss = buildCss(theme);
  const bundledHash = createHash("sha256").update(bundledCss).digest("hex");

  // Fast path: compare hash of existing file to expected hash.
  try {
    const existing = await readFile(dest, "utf8");
    const existingHash = createHash("sha256").update(existing).digest("hex");
    if (existingHash === bundledHash) {
      return; // already up-to-date
    }
  } catch {
    // ENOENT or unreadable — fall through to write
  }

  await atomicWrite(dest, bundledCss);
}

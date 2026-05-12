// Materializes /theme.css in the state directory, atomically and idempotently.

import { createHash } from "node:crypto";
import { join } from "node:path";
import { frameworkRulesCss, themeTokensCss, defaultTheme } from "../render/theme.ts";
import { atomicWrite } from "./write.ts";
import { readFile } from "node:fs/promises";

/** Full CSS for theme.css: tokens + framework rules.
 *  Computed once at module load and cached. */
const BUNDLED_CSS: string = (() => {
  const theme = defaultTheme();
  return themeTokensCss(theme) + "\n" + frameworkRulesCss();
})();

/** SHA-256 of the bundled CSS — computed once at module load. */
const BUNDLED_HASH: string = createHash("sha256").update(BUNDLED_CSS).digest("hex");

/** Returns the absolute path to theme.css in stateDir. */
export function themeCssAssetPath(stateDir: string): string {
  return join(stateDir, "theme.css");
}

/**
 * Writes <stateDir>/theme.css with the full framework CSS (tokens + rules)
 * iff the on-disk file is missing or its content hash differs from the
 * bundled version.  Idempotent and self-healing on plugin upgrade.
 */
export async function ensureThemeCss(stateDir: string): Promise<void> {
  const dest = themeCssAssetPath(stateDir);

  // Fast path: compare hash of existing file to bundled hash.
  try {
    const existing = await readFile(dest, "utf8");
    const existingHash = createHash("sha256").update(existing).digest("hex");
    if (existingHash === BUNDLED_HASH) {
      return; // already up-to-date
    }
  } catch {
    // ENOENT or unreadable — fall through to write
  }

  await atomicWrite(dest, BUNDLED_CSS);
}

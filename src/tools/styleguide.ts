// Tool handler for cesium_styleguide — returns the full CSS reference page as a string.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";

const STYLEGUIDE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../assets/styleguide.html",
);

export function createStyleguideTool(_ctx: PluginInput): ReturnType<typeof tool> {
  return tool({
    description:
      "Returns the cesium HTML design system reference page (CSS classes with example usage). Call this once at the start of writing a complex artifact to internalize the available components.",
    args: {},
    async execute(_args, _context) {
      return await readFile(STYLEGUIDE_PATH, "utf8");
    },
  });
}

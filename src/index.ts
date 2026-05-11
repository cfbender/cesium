// Plugin entry point — registers cesium_publish and cesium_styleguide tools,
// and injects the system-prompt fragment into the agent session.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, Hooks } from "@opencode-ai/plugin";
import { createPublishTool } from "./tools/publish.ts";
import { createStyleguideTool } from "./tools/styleguide.ts";
import { createCritiqueTool } from "./tools/critique.ts";

const PROMPT_FRAGMENT = await readFile(
  join(dirname(fileURLToPath(import.meta.url)), "prompt/system-fragment.md"),
  "utf8",
);

export const CesiumPlugin: Plugin = async (ctx): Promise<Hooks> => {
  return {
    tool: {
      cesium_publish: createPublishTool(ctx),
      cesium_styleguide: createStyleguideTool(ctx),
      cesium_critique: createCritiqueTool(ctx),
    },
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(PROMPT_FRAGMENT);
    },
  };
};

export default CesiumPlugin;

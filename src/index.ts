// Plugin entry point — registers cesium tools and injects the system-prompt fragment.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, Hooks } from "@opencode-ai/plugin";
import { createPublishTool } from "./tools/publish.ts";
import { createAskTool } from "./tools/ask.ts";
import { createAnnotateTool } from "./tools/annotate.ts";
import { createWaitTool } from "./tools/wait.ts";
import { createStyleguideTool } from "./tools/styleguide.ts";
import { createCritiqueTool } from "./tools/critique.ts";
import { createStopTool } from "./tools/stop.ts";
import { generateBlockFieldReference } from "./prompt/field-reference.ts";

const rawFragment = await readFile(
  join(dirname(fileURLToPath(import.meta.url)), "prompt/system-fragment.md"),
  "utf8",
);

const PROMPT_FRAGMENT = rawFragment.replace(
  "{{BLOCK_FIELD_REFERENCE}}",
  generateBlockFieldReference(),
);

export const CesiumPlugin: Plugin = async (ctx): Promise<Hooks> => {
  return {
    tool: {
      cesium_publish: createPublishTool(ctx),
      cesium_ask: createAskTool(ctx),
      cesium_annotate: createAnnotateTool(ctx),
      cesium_wait: createWaitTool(ctx),
      cesium_styleguide: createStyleguideTool(ctx),
      cesium_critique: createCritiqueTool(ctx),
      cesium_stop: createStopTool(ctx),
    },
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(PROMPT_FRAGMENT);
    },
  };
};

export default CesiumPlugin;

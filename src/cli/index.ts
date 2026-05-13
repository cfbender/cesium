#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import pkg from "../../package.json" with { type: "json" };

export const CESIUM_VERSION: string = pkg.version;

const main = defineCommand({
  meta: {
    name: "cesium",
    version: pkg.version,
    description: "artifact manager for opencode sessions",
  },
  subCommands: {
    ls: () => import("./commands/ls.ts").then((m) => m.lsCmd),
    open: () => import("./commands/open.ts").then((m) => m.openCmd),
    serve: () => import("./commands/serve.ts").then((m) => m.serveCmd),
    stop: () => import("./commands/stop.ts").then((m) => m.stopCmd),
    restart: () => import("./commands/restart.ts").then((m) => m.restartCmd),
    prune: () => import("./commands/prune.ts").then((m) => m.pruneCmd),
    theme: () => import("./commands/theme.ts").then((m) => m.themeCmd),
  },
});

await runMain(main);

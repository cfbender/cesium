#!/usr/bin/env bun

import { parseArgs as _parseArgs } from "node:util";
import { lsCommand } from "./commands/ls.ts";
import { openCommand } from "./commands/open.ts";
import { serveCommand } from "./commands/serve.ts";
import { stopCommand } from "./commands/stop.ts";
import { restartCommand } from "./commands/restart.ts";
import { pruneCommand } from "./commands/prune.ts";
import { themeCommand } from "./commands/theme.ts";

const subcommand = process.argv[2];
const rest = process.argv.slice(3);

const COMMANDS: Record<string, (argv: string[]) => Promise<number>> = {
  ls: lsCommand,
  open: openCommand,
  serve: serveCommand,
  stop: stopCommand,
  restart: restartCommand,
  prune: pruneCommand,
  theme: themeCommand,
};

function printHelp(): void {
  process.stdout.write(
    [
      "cesium — artifact manager for opencode sessions",
      "",
      "Usage: cesium <command> [options]",
      "",
      "Commands:",
      "  ls       List artifacts in the current project (or all with --all)",
      "  open     Open an artifact by id prefix in the browser",
      "  serve    Start the local HTTP server in the foreground",
      "  stop     Stop the running cesium server",
      "  restart  Stop and re-start the cesium server",
      "  prune    Delete artifacts older than a given duration",
      "  theme    Show or apply the configured theme",
      "",
      "Options:",
      "  --help, -h  Show this help message",
      "",
      "Run 'cesium <command> --help' for command-specific options.",
      "",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    printHelp();
    process.exit(subcommand ? 0 : 1);
  }
  const fn = COMMANDS[subcommand];
  if (!fn) {
    process.stderr.write(`cesium: unknown command: ${subcommand}\n`);
    printHelp();
    process.exit(1);
  }
  const code = await fn(rest);
  process.exit(code);
}

await main();

// Tool handler for cesium_stop — stops the running cesium HTTP server cross-process.

import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import { loadConfig } from "../config.ts";
import { stopServer } from "../server/stop.ts";
import type { StopOutcome } from "../server/stop.ts";

const TOOL_DESCRIPTION = `Stop the running cesium HTTP server.

Idempotent: returns a clear message when no server is running. Sends SIGTERM
with a 3s grace period, then SIGKILL if the process hasn't exited. The agent
can call this when:
- The user explicitly asks to stop or restart the cesium server.
- The user is changing config (port, hostname, theme) and wants the new server
  to start fresh on the next publish.
- Cleanup at session end is desired.

Note: the next call to cesium_publish will lazy-start a new server, so calling
this between publishes effectively cycles the server with the latest config.`;

export function formatStopOutcome(outcome: StopOutcome): string {
  switch (outcome.kind) {
    case "not-running":
      return "no cesium server running";
    case "stale":
      return "server not running (stale PID file removed)";
    case "stopped":
      return `stopped cesium server (pid ${outcome.pid}, port ${outcome.port}, ${outcome.signal})`;
    case "permission-denied":
      return `could not stop server: permission denied (pid ${outcome.pid} owned by another user)`;
  }
}

export function createStopTool(_ctx: PluginInput): ReturnType<typeof tool> {
  return tool({
    description: TOOL_DESCRIPTION,
    args: {
      force: tool.schema.boolean().optional(),
      timeoutMs: tool.schema.number().optional(),
    },
    async execute(args) {
      const config = loadConfig();
      const stopArgs: Parameters<typeof stopServer>[0] = {
        stateDir: config.stateDir,
        ...(args.force !== undefined ? { force: args.force } : {}),
        ...(args.timeoutMs !== undefined ? { timeoutMs: args.timeoutMs } : {}),
      };
      const outcome = await stopServer(stopArgs);
      return formatStopOutcome(outcome);
    },
  });
}

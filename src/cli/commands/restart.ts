// cesium restart — stop the running server and start a new one in the foreground.

import { type StopContext, stopCommand } from "./stop.ts";
import { type ServeContext, serveCommand as defaultServeCommand } from "./serve.ts";

export interface RestartContext extends StopContext, ServeContext {
  /** Test injection: replace serveCommand with a mock so tests don't block. */
  serveImpl?: (argv: string[], ctx?: Partial<RestartContext>) => Promise<number>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function restartCommand(
  argv: string[],
  ctx?: Partial<RestartContext>,
): Promise<number> {
  const sleepFn = ctx?.sleep ?? defaultSleep;
  const serveFn = ctx?.serveImpl ?? defaultServeCommand;

  // 1. Stop any running server
  const stopCode = await stopCommand(argv, ctx);
  if (stopCode !== 0) {
    // e.g. EPERM — bail, pass through exit code
    return stopCode;
  }

  // 2. Brief pause to let the port fully release
  await sleepFn(200);

  // 3. Announce restart
  const stdout = ctx?.stdout ?? process.stdout;
  stdout.write("starting new cesium server...\n");

  // 4. Start the new server in foreground (blocks until Ctrl-C)
  return serveFn(argv, ctx);
}

// Config loader — reads and validates ~/.config/opencode/cesium.json.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ThemePalette } from "./render/theme.ts";

export interface CesiumConfig {
  stateDir: string;
  port: number;
  portMax: number;
  idleTimeoutMs: number;
  theme?: Partial<ThemePalette>;
}

export function defaultConfig(env?: NodeJS.ProcessEnv): CesiumConfig {
  const e = env ?? process.env;
  const xdgState = e["XDG_STATE_HOME"];
  const stateDir = xdgState
    ? join(xdgState, "cesium")
    : join(homedir(), ".local", "state", "cesium");
  return {
    stateDir,
    port: 3030,
    portMax: 3050,
    idleTimeoutMs: 30 * 60 * 1000,
  };
}

interface RawConfig {
  stateDir?: unknown;
  port?: unknown;
  portMax?: unknown;
  idleTimeoutMs?: unknown;
  theme?: unknown;
}

export function loadConfig(opts?: { configPath?: string; env?: NodeJS.ProcessEnv }): CesiumConfig {
  const env = opts?.env ?? process.env;
  const base = defaultConfig(env);

  const configPath =
    opts?.configPath ??
    join(env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config"), "opencode", "cesium.json");

  let fileConfig: RawConfig = {};
  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      fileConfig = parsed as RawConfig;
    }
  } catch {
    // File missing or unreadable — use defaults
  }

  const merged: CesiumConfig = { ...base };

  if (typeof fileConfig.stateDir === "string") merged.stateDir = fileConfig.stateDir;
  if (typeof fileConfig.port === "number") merged.port = fileConfig.port;
  if (typeof fileConfig.portMax === "number") merged.portMax = fileConfig.portMax;
  if (typeof fileConfig.idleTimeoutMs === "number") merged.idleTimeoutMs = fileConfig.idleTimeoutMs;
  if (
    fileConfig.theme !== null &&
    typeof fileConfig.theme === "object" &&
    !Array.isArray(fileConfig.theme)
  ) {
    merged.theme = fileConfig.theme as Partial<ThemePalette>;
  }

  // Env overrides
  const envPort = env["CESIUM_PORT"];
  if (envPort !== undefined) {
    const p = parseInt(envPort, 10);
    if (!isNaN(p)) merged.port = p;
  }
  const envStateDir = env["CESIUM_STATE_DIR"];
  if (envStateDir !== undefined) merged.stateDir = envStateDir;

  return merged;
}

import { test, expect } from "bun:test";
import { parseDuration, validateServeArgs } from "../src/cli/commands/serve.ts";
import type { ServeContext } from "../src/cli/commands/serve.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function captureCtx(): ServeContext & { out: string; err: string } {
  let out = "";
  let err = "";
  return {
    stdout: {
      write: (s: string) => {
        out += s;
      },
    },
    stderr: {
      write: (s: string) => {
        err += s;
      },
    },
    get out() {
      return out;
    },
    get err() {
      return err;
    },
  };
}

// ─── parseDuration ────────────────────────────────────────────────────────────

test("parseDuration: 0 → 0", () => {
  expect(parseDuration("0")).toBe(0);
});

test("parseDuration: 'never' → 0", () => {
  expect(parseDuration("never")).toBe(0);
});

test("parseDuration: 'off' → 0", () => {
  expect(parseDuration("off")).toBe(0);
});

test("parseDuration: 30m → 30 * 60000", () => {
  expect(parseDuration("30m")).toBe(30 * 60_000);
});

test("parseDuration: 90s → 90000", () => {
  expect(parseDuration("90s")).toBe(90_000);
});

test("parseDuration: 2h → 2 * 3600000", () => {
  expect(parseDuration("2h")).toBe(2 * 3_600_000);
});

test("parseDuration: bare number treated as ms", () => {
  expect(parseDuration("5000")).toBe(5000);
});

test("parseDuration: garbage → null", () => {
  expect(parseDuration("tomorrow")).toBeNull();
});

test("parseDuration: negative → null", () => {
  expect(parseDuration("-5m")).toBeNull();
});

// ─── validateServeArgs ────────────────────────────────────────────────────────

test("validateServeArgs: empty args passes through", () => {
  const ctx = captureCtx();
  const result = validateServeArgs({}, ctx);
  expect(result).not.toBeNull();
  expect(result?.port).toBeUndefined();
  expect(result?.hostname).toBeUndefined();
});

test("validateServeArgs: valid port passes", () => {
  const ctx = captureCtx();
  const result = validateServeArgs({ port: 4000 }, ctx);
  expect(result?.port).toBe(4000);
});

test("validateServeArgs: out-of-range port rejected", () => {
  const ctx = captureCtx();
  const result = validateServeArgs({ port: 70000 }, ctx);
  expect(result).toBeNull();
  expect(ctx.err).toContain("--port");
});

test("validateServeArgs: empty hostname rejected", () => {
  const ctx = captureCtx();
  const result = validateServeArgs({ hostname: "" }, ctx);
  expect(result).toBeNull();
  expect(ctx.err).toContain("--hostname");
});

test("validateServeArgs: valid hostname passes", () => {
  const ctx = captureCtx();
  const result = validateServeArgs({ hostname: "0.0.0.0" }, ctx);
  expect(result?.hostname).toBe("0.0.0.0");
});

test("validateServeArgs: idleTimeoutMs 0 passes", () => {
  const ctx = captureCtx();
  const result = validateServeArgs({ idleTimeoutMs: 0 }, ctx);
  expect(result?.idleTimeoutMs).toBe(0);
});

test("validateServeArgs: negative idleTimeoutMs rejected", () => {
  const ctx = captureCtx();
  const result = validateServeArgs({ idleTimeoutMs: -1 }, ctx);
  expect(result).toBeNull();
  expect(ctx.err).toContain("--idle-timeout");
});

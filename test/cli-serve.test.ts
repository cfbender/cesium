import { test, expect } from "bun:test";
import { parseServeArgs } from "../src/cli/commands/serve.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function captureIo(): {
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
  out: string;
  err: string;
} {
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

// ─── Tests ────────────────────────────────────────────────────────────────────

test("parseServeArgs with no args returns empty options object", () => {
  const io = captureIo();
  const result = parseServeArgs([], io);
  expect(result).not.toBeNull();
  expect(result).not.toBe("help");
  if (result === null || result === "help") return;
  expect(result.port).toBeUndefined();
  expect(result.hostname).toBeUndefined();
});

test("parseServeArgs --help returns 'help' sentinel", () => {
  const io = captureIo();
  const result = parseServeArgs(["--help"], io);
  expect(result).toBe("help");
  expect(io.out).toContain("Usage: cesium serve");
  expect(io.out).toContain("--port");
  expect(io.out).toContain("--hostname");
});

test("parseServeArgs --port sets port", () => {
  const io = captureIo();
  const result = parseServeArgs(["--port", "4000"], io);
  expect(result).not.toBeNull();
  if (result === null || result === "help") return;
  expect(result.port).toBe(4000);
});

test("parseServeArgs --hostname sets hostname", () => {
  const io = captureIo();
  const result = parseServeArgs(["--hostname", "0.0.0.0"], io);
  expect(result).not.toBeNull();
  if (result === null || result === "help") return;
  expect(result.hostname).toBe("0.0.0.0");
});

test("parseServeArgs invalid port returns null and writes error", () => {
  const io = captureIo();
  const result = parseServeArgs(["--port", "not-a-number"], io);
  expect(result).toBeNull();
  expect(io.err).toContain("--port");
});

test("parseServeArgs empty hostname returns null and writes error", () => {
  const io = captureIo();
  const result = parseServeArgs(["--hostname", ""], io);
  expect(result).toBeNull();
  expect(io.err).toContain("--hostname");
});

test("parseServeArgs -p short flag works", () => {
  const io = captureIo();
  const result = parseServeArgs(["-p", "5000"], io);
  expect(result).not.toBeNull();
  if (result === null || result === "help") return;
  expect(result.port).toBe(5000);
});

test("parseServeArgs unknown option returns null and writes error", () => {
  const io = captureIo();
  const result = parseServeArgs(["--unknown-flag"], io);
  expect(result).toBeNull();
  expect(io.err).not.toBe("");
});

test("parseServeArgs no --idle-timeout leaves idleTimeoutMs undefined (default: never)", () => {
  const io = captureIo();
  const result = parseServeArgs([], io);
  if (result === null || result === "help") throw new Error("expected options");
  expect(result.idleTimeoutMs).toBeUndefined();
});

test("parseServeArgs --idle-timeout 0 sets idleTimeoutMs to 0", () => {
  const io = captureIo();
  const result = parseServeArgs(["--idle-timeout", "0"], io);
  if (result === null || result === "help") throw new Error("expected options");
  expect(result.idleTimeoutMs).toBe(0);
});

test("parseServeArgs --idle-timeout never sets idleTimeoutMs to 0", () => {
  const io = captureIo();
  const result = parseServeArgs(["--idle-timeout", "never"], io);
  if (result === null || result === "help") throw new Error("expected options");
  expect(result.idleTimeoutMs).toBe(0);
});

test("parseServeArgs --idle-timeout 30m parses minutes", () => {
  const io = captureIo();
  const result = parseServeArgs(["--idle-timeout", "30m"], io);
  if (result === null || result === "help") throw new Error("expected options");
  expect(result.idleTimeoutMs).toBe(30 * 60_000);
});

test("parseServeArgs --idle-timeout 90s parses seconds", () => {
  const io = captureIo();
  const result = parseServeArgs(["--idle-timeout", "90s"], io);
  if (result === null || result === "help") throw new Error("expected options");
  expect(result.idleTimeoutMs).toBe(90_000);
});

test("parseServeArgs --idle-timeout 2h parses hours", () => {
  const io = captureIo();
  const result = parseServeArgs(["--idle-timeout", "2h"], io);
  if (result === null || result === "help") throw new Error("expected options");
  expect(result.idleTimeoutMs).toBe(2 * 3_600_000);
});

test("parseServeArgs --idle-timeout with bare number treats as ms", () => {
  const io = captureIo();
  const result = parseServeArgs(["--idle-timeout", "5000"], io);
  if (result === null || result === "help") throw new Error("expected options");
  expect(result.idleTimeoutMs).toBe(5000);
});

test("parseServeArgs --idle-timeout garbage returns null and writes error", () => {
  const io = captureIo();
  const result = parseServeArgs(["--idle-timeout", "tomorrow"], io);
  expect(result).toBeNull();
  expect(io.err).toContain("--idle-timeout");
});

test("parseServeArgs --idle-timeout negative returns null and writes error", () => {
  const io = captureIo();
  const result = parseServeArgs(["--idle-timeout", "-5m"], io);
  expect(result).toBeNull();
  expect(io.err).toContain("--idle-timeout");
});

test("parseServeArgs --help mentions idle-timeout default", () => {
  const io = captureIo();
  parseServeArgs(["--help"], io);
  expect(io.out).toContain("--idle-timeout");
  expect(io.out.toLowerCase()).toContain("never");
});

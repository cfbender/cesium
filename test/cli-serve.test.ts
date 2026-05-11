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

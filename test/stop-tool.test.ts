import { test, expect, describe } from "bun:test";
import { formatStopOutcome } from "../src/tools/stop.ts";
import type { StopOutcome } from "../src/server/stop.ts";

describe("formatStopOutcome", () => {
  test("not-running returns 'no cesium server running'", () => {
    const outcome: StopOutcome = { kind: "not-running" };
    expect(formatStopOutcome(outcome)).toBe("no cesium server running");
  });

  test("stale returns message containing 'stale PID file removed'", () => {
    const outcome: StopOutcome = { kind: "stale", pid: 12345 };
    expect(formatStopOutcome(outcome)).toContain("stale PID file removed");
  });

  test("stopped with SIGTERM includes pid, port, SIGTERM", () => {
    const outcome: StopOutcome = { kind: "stopped", pid: 12345, port: 3030, signal: "SIGTERM" };
    const msg = formatStopOutcome(outcome);
    expect(msg).toContain("12345");
    expect(msg).toContain("3030");
    expect(msg).toContain("SIGTERM");
    expect(msg).toContain("stopped");
  });

  test("stopped with SIGKILL includes pid, port, SIGKILL", () => {
    const outcome: StopOutcome = { kind: "stopped", pid: 99, port: 3031, signal: "SIGKILL" };
    const msg = formatStopOutcome(outcome);
    expect(msg).toContain("99");
    expect(msg).toContain("3031");
    expect(msg).toContain("SIGKILL");
  });

  test("permission-denied includes pid and permission denied text", () => {
    const outcome: StopOutcome = { kind: "permission-denied", pid: 42 };
    const msg = formatStopOutcome(outcome);
    expect(msg).toContain("42");
    expect(msg).toContain("permission denied");
  });

  test("all four outcome kinds produce non-empty strings", () => {
    const outcomes: StopOutcome[] = [
      { kind: "not-running" },
      { kind: "stale", pid: 1 },
      { kind: "stopped", pid: 1, port: 3030, signal: "SIGTERM" },
      { kind: "permission-denied", pid: 1 },
    ];
    for (const o of outcomes) {
      expect(formatStopOutcome(o).length).toBeGreaterThan(0);
    }
  });
});

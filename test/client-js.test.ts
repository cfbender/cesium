import { describe, expect, test } from "bun:test";
import { getClientJs } from "../src/render/client-js.ts";

describe("getClientJs", () => {
  test("returns a non-empty string", () => {
    const js = getClientJs();
    expect(typeof js).toBe("string");
    expect(js.length).toBeGreaterThan(100);
  });

  test("contains fetch( for network calls", () => {
    expect(getClientJs()).toContain("fetch(");
  });

  test("contains /api/sessions/ path fragment", () => {
    expect(getClientJs()).toContain("/api/sessions/");
  });

  test("derives API URL from window.location.pathname (not meta.id)", () => {
    const js = getClientJs();
    // New pattern: extract project slug and filename from location
    expect(js).toContain("window.location.pathname");
    expect(js).toContain("/projects/");
    expect(js).toContain("/artifacts/");
    // Should NOT reference meta.id for URL construction
    expect(js).not.toContain("artifactId");
  });

  test("contains apiBase variable derived from pathname match", () => {
    const js = getClientJs();
    expect(js).toContain("apiBase");
    expect(js).toContain("m[1]");
    expect(js).toContain("m[2]");
  });

  test("handles null apiBase (file:// or unrecognized URL) gracefully", () => {
    const js = getClientJs();
    // Should check for null apiBase and handle gracefully
    expect(js).toContain("!apiBase");
  });

  test("shows offline/file-view banner when not served via cesium HTTP", () => {
    const js = getClientJs();
    expect(js).toContain("cs-banner-offline");
    expect(js).toContain("cesium HTTP server");
  });

  test("contains DOMContentLoaded listener", () => {
    expect(getClientJs()).toContain("DOMContentLoaded");
  });

  test("wraps in named IIFE (cesiumClient)", () => {
    const js = getClientJs();
    expect(js).toMatch(/\(function\s+cesiumClient\s*\(\s*\)/);
  });

  test("contains handler for .cs-pick (pick_one / pick_many)", () => {
    expect(getClientJs()).toContain(".cs-pick");
  });

  test("contains handler for .cs-confirm", () => {
    expect(getClientJs()).toContain(".cs-confirm");
  });

  test("contains handler for .cs-react", () => {
    expect(getClientJs()).toContain(".cs-react");
  });

  test("contains handler for .cs-submit", () => {
    expect(getClientJs()).toContain(".cs-submit");
  });

  test("contains handler for .cs-slider", () => {
    expect(getClientJs()).toContain(".cs-slider");
  });

  test("contains handler for .cs-text", () => {
    expect(getClientJs()).toContain(".cs-text");
  });

  test("does NOT contain any external http:// URLs", () => {
    expect(getClientJs()).not.toMatch(/https?:\/\//);
  });

  test("handles 410 status for session ended", () => {
    expect(getClientJs()).toContain("410");
  });

  test("shows session ended banner on 410", () => {
    expect(getClientJs()).toContain("cs-banner-ended");
  });

  test("shows .cs-error for failed requests", () => {
    expect(getClientJs()).toContain("cs-error");
  });

  test("sets cs-saving class during pending state", () => {
    expect(getClientJs()).toContain("cs-saving");
  });

  test("uses POST method for answer submission", () => {
    expect(getClientJs()).toContain('"POST"');
  });

  test("sets Content-Type: application/json header", () => {
    expect(getClientJs()).toContain("application/json");
  });

  test("contains pick_one type in submitted value", () => {
    expect(getClientJs()).toContain('"pick_one"');
  });

  test("contains pick_many type in submitted value", () => {
    expect(getClientJs()).toContain('"pick_many"');
  });

  test("contains confirm type in submitted value", () => {
    expect(getClientJs()).toContain('"confirm"');
  });

  test("contains ask_text type in submitted value", () => {
    expect(getClientJs()).toContain('"ask_text"');
  });

  test("contains slider type in submitted value", () => {
    expect(getClientJs()).toContain('"slider"');
  });

  test("contains react type in submitted value", () => {
    expect(getClientJs()).toContain('"react"');
  });

  test("uses replacementHtml from server response", () => {
    expect(getClientJs()).toContain("replacementHtml");
  });

  test("uses data-question-id to find the section", () => {
    expect(getClientJs()).toContain("data-question-id");
  });

  test("uses 'use strict'", () => {
    expect(getClientJs()).toContain('"use strict"');
  });

  test("contains no import statements (inline browser script)", () => {
    expect(getClientJs()).not.toMatch(/^\s*import\s/m);
  });

  test("contains cs-skip handler", () => {
    const js = getClientJs();
    expect(js).toContain("cs-skip");
  });

  test("skip handler POSTs ask_text with empty text string", () => {
    const js = getClientJs();
    // The skip handler calls submitAnswer with { type: "ask_text", text: "" }
    expect(js).toContain('"ask_text"');
    // The skip path explicitly sets text to empty string
    expect(js).toContain('text: ""');
  });
});

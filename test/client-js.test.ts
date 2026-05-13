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

describe("getClientJs — annotate wiring", () => {
  test("dispatches on kind === 'annotate'", () => {
    expect(getClientJs()).toContain('kind === "annotate"');
  });

  test("contains wireAnnotate function", () => {
    expect(getClientJs()).toContain("wireAnnotate");
  });

  test("contains apiBase + /comments path", () => {
    expect(getClientJs()).toContain('apiBase + "/comments"');
  });

  test("contains apiBase + /verdict path", () => {
    expect(getClientJs()).toContain('apiBase + "/verdict"');
  });

  test("contains DELETE method for comment removal", () => {
    expect(getClientJs()).toContain('"DELETE"');
  });

  test("contains popup template clone logic", () => {
    expect(getClientJs()).toContain("cloneNode");
    expect(getClientJs()).toContain("cs-annotate-comment-popup");
  });

  test("contains anchor affordance injection", () => {
    expect(getClientJs()).toContain("data-cesium-anchor");
    expect(getClientJs()).toContain("cs-anchor-affordance");
  });

  test("contains humanizeAnchor helper", () => {
    expect(getClientJs()).toContain("humanizeAnchor");
  });

  test("contains escapeHtml helper", () => {
    expect(getClientJs()).toContain("escapeHtml");
  });

  test("contains cs-comment-bubble class in bubble builder", () => {
    expect(getClientJs()).toContain("cs-comment-bubble");
  });

  test("contains cs-comment-delete class", () => {
    expect(getClientJs()).toContain("cs-comment-delete");
  });

  test("contains verdict button enablement logic", () => {
    expect(getClientJs()).toContain("updateVerdictButtons");
  });

  test("contains comment count update", () => {
    expect(getClientJs()).toContain("updateCount");
    expect(getClientJs()).toContain("data-cesium-comment-count");
  });

  test("reloads page after successful verdict submission", () => {
    expect(getClientJs()).toContain("window.location.reload");
  });

  test("seeds comments from interactive.comments array", () => {
    expect(getClientJs()).toContain("interactiveData.comments");
  });

  test("handles offline mode in annotate (hides affordances, disables verdict)", () => {
    const js = getClientJs();
    expect(js).toContain("freezeUi");
  });

  test("approve verdict always enabled (no comment requirement)", () => {
    const js = getClientJs();
    // Approve button: disabled = false regardless of comments
    expect(js).toContain('"approve"');
    expect(js).toContain("btn.disabled = false");
  });

  test("contains cs-comment-anchor-label for humanized anchor in bubble", () => {
    expect(getClientJs()).toContain("cs-comment-anchor-label");
  });

  test("ask wiring still present (wireAsk function)", () => {
    expect(getClientJs()).toContain("wireAsk");
  });

  test("ask and annotate share same IIFE / apiBase derivation", () => {
    const js = getClientJs();
    // apiBase is computed once at the top level
    const apiBaseCount = (js.match(/var apiBase/g) || []).length;
    expect(apiBaseCount).toBe(1);
  });

  test("does NOT contain any external http:// URLs", () => {
    expect(getClientJs()).not.toMatch(/https?:\/\//);
  });

  test("contains positionBubbles helper for anchor alignment", () => {
    expect(getClientJs()).toContain("positionBubbles");
  });

  test("contains cs-anchor-active class for hover linking", () => {
    expect(getClientJs()).toContain("cs-anchor-active");
  });

  test("contains cs-comment-bubble-active class for mutual hover", () => {
    expect(getClientJs()).toContain("cs-comment-bubble-active");
  });

  test("contains resize debounce for bubble repositioning", () => {
    expect(getClientJs()).toContain("onResize");
    expect(getClientJs()).toContain("resizeTimer");
  });

  test("contains wireHoverLinking helper", () => {
    expect(getClientJs()).toContain("wireHoverLinking");
  });

  test("positionBubbles is called on requestAnimationFrame after DOMContentLoaded", () => {
    expect(getClientJs()).toContain("requestAnimationFrame(positionBubbles)");
  });
});

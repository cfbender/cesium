import { describe, expect, test } from "bun:test";
import { createFaviconHandler } from "../src/server/favicon.ts";
import { FAVICON_SVG } from "../src/render/favicon.ts";

describe("createFaviconHandler", () => {
  test("returns favicon SVG bytes for GET /favicon.ico", async () => {
    const handler = createFaviconHandler();
    const req = new Request("http://localhost:3030/favicon.ico");
    const res = await handler(req);
    expect(res).toBeDefined();
    expect(res?.status).toBe(200);
    expect(res?.headers.get("content-type")).toContain("image/svg+xml");
    const text = await res?.text();
    expect(text).toBe(FAVICON_SVG);
  });

  test("returns favicon SVG bytes for HEAD /favicon.ico", async () => {
    const handler = createFaviconHandler();
    const req = new Request("http://localhost:3030/favicon.ico", { method: "HEAD" });
    const res = await handler(req);
    expect(res).toBeDefined();
    expect(res?.status).toBe(200);
  });

  test("falls through (returns undefined) for unrelated paths", async () => {
    const handler = createFaviconHandler();
    expect(await handler(new Request("http://localhost:3030/index.html"))).toBeUndefined();
    expect(await handler(new Request("http://localhost:3030/favicon.svg"))).toBeUndefined();
    expect(
      await handler(new Request("http://localhost:3030/projects/foo/favicon.ico")),
    ).toBeUndefined();
  });

  test("falls through for non-GET/HEAD methods", async () => {
    const handler = createFaviconHandler();
    const req = new Request("http://localhost:3030/favicon.ico", { method: "POST" });
    expect(await handler(req)).toBeUndefined();
  });

  test("response includes a Cache-Control header", async () => {
    const handler = createFaviconHandler();
    const req = new Request("http://localhost:3030/favicon.ico");
    const res = await handler(req);
    expect(res?.headers.get("cache-control")).toContain("max-age=");
  });
});

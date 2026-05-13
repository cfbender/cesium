import { describe, expect, test } from "bun:test";
import { createFaviconApp } from "../src/server/favicon.ts";
import { FAVICON_SVG } from "../src/render/favicon.ts";

describe("createFaviconApp", () => {
  test("returns favicon SVG bytes for GET /favicon.ico", async () => {
    const app = createFaviconApp();
    const res = await app.fetch(new Request("http://localhost:3030/favicon.ico"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    const text = await res.text();
    expect(text).toBe(FAVICON_SVG);
  });

  test("returns favicon SVG bytes for HEAD /favicon.ico", async () => {
    const app = createFaviconApp();
    const res = await app.fetch(
      new Request("http://localhost:3030/favicon.ico", { method: "HEAD" }),
    );
    expect(res.status).toBe(200);
  });

  test("does not match unrelated paths (404)", async () => {
    const app = createFaviconApp();
    expect((await app.fetch(new Request("http://localhost:3030/index.html"))).status).toBe(404);
    expect((await app.fetch(new Request("http://localhost:3030/favicon.svg"))).status).toBe(404);
    expect(
      (await app.fetch(new Request("http://localhost:3030/projects/foo/favicon.ico"))).status,
    ).toBe(404);
  });

  test("does not match non-GET/HEAD methods (404)", async () => {
    const app = createFaviconApp();
    const res = await app.fetch(
      new Request("http://localhost:3030/favicon.ico", { method: "POST" }),
    );
    expect(res.status).toBe(404);
  });

  test("response includes a Cache-Control header", async () => {
    const app = createFaviconApp();
    const res = await app.fetch(new Request("http://localhost:3030/favicon.ico"));
    expect(res.headers.get("cache-control")).toContain("max-age=");
  });
});

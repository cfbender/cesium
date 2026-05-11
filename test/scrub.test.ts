import { describe, expect, test } from "bun:test";
import { scrub, type ScrubResult } from "../src/render/scrub.ts";

describe("scrub — script removal", () => {
  test("removes <script src='...'> with any URL", () => {
    const result = scrub('<script src="http://evil.com/x.js"></script><p>hello</p>');
    // Replaced with HTML comment; cesium removal marker present
    expect(result.html).toContain("<!--");
    expect(result.html).toContain("cesium: removed external");
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]?.reason).toBe("script-src");
  });

  test("removes <script src='https://...'> too", () => {
    const result = scrub('<script src="https://cdn.example.com/lib.js"></script>');
    expect(result.removed[0]?.reason).toBe("script-src");
  });

  test("leaves inline <script> untouched", () => {
    const result = scrub("<script>const x = 1;</script>");
    expect(result.html).toContain("<script>");
    expect(result.removed).toHaveLength(0);
  });

  test("removed entry contains original src", () => {
    const result = scrub('<script src="http://evil.com/x.js"></script>');
    expect(result.removed[0]?.original).toContain("http://evil.com/x.js");
  });
});

describe("scrub — stylesheet removal", () => {
  test("removes <link rel='stylesheet' href='http...'> ", () => {
    const result = scrub('<link rel="stylesheet" href="http://example.com/style.css">');
    // Replaced with HTML comment
    expect(result.html).toContain("<!--");
    expect(result.html).toContain("cesium: removed external");
    expect(result.removed[0]?.reason).toBe("stylesheet-href");
  });

  test("removes https stylesheet link", () => {
    const result = scrub(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto">',
    );
    expect(result.removed[0]?.reason).toBe("stylesheet-href");
    expect(result.removed[0]?.original).toContain("fonts.googleapis.com");
  });

  test("leaves <style> inline untouched", () => {
    const result = scrub("<style>body { color: red; }</style>");
    expect(result.html).toContain("<style>");
    expect(result.removed).toHaveLength(0);
  });

  test("leaves <link rel='icon'> untouched", () => {
    const result = scrub('<link rel="icon" href="/favicon.ico">');
    expect(result.removed).toHaveLength(0);
    // icon link is not a stylesheet — should not be removed
    expect(result.html).toContain("favicon.ico");
  });
});

describe("scrub — img removal", () => {
  test("removes <img src='http...'> ", () => {
    const result = scrub('<img src="http://example.com/photo.jpg" alt="photo">');
    // Replaced with HTML comment
    expect(result.html).toContain("<!--");
    expect(result.html).toContain("cesium: removed external");
    expect(result.removed[0]?.reason).toBe("img-http");
  });

  test("removes <img src='https...'> ", () => {
    const result = scrub('<img src="https://example.com/photo.jpg">');
    expect(result.removed[0]?.reason).toBe("img-http");
  });

  test("leaves data: URI image untouched", () => {
    const result = scrub('<img src="data:image/png;base64,abc123" alt="inline">');
    expect(result.html).toContain("data:image/png");
    expect(result.removed).toHaveLength(0);
  });

  test("leaves relative path image untouched", () => {
    const result = scrub('<img src="./images/chart.png" alt="chart">');
    expect(result.removed).toHaveLength(0);
    expect(result.html).toContain("./images/chart.png");
  });
});

describe("scrub — inline style url() scrubbing", () => {
  test("removes url(http...) from inline style", () => {
    const result = scrub(
      '<div style="background: url(http://evil.com/bg.png); color: red">hi</div>',
    );
    expect(result.html).toContain("url()");
    expect(result.html).toContain("color: red");
    expect(result.removed[0]?.reason).toBe("url-http");
  });

  test("removes url(https...) from inline style", () => {
    const result = scrub(
      '<div style="background-image: url(https://cdn.example.com/img.png)">x</div>',
    );
    expect(result.removed[0]?.reason).toBe("url-http");
  });

  test("original contains the removed url", () => {
    const result = scrub('<div style="background: url(http://evil.com/bg.png)">hi</div>');
    expect(result.removed[0]?.original).toContain("http://evil.com/bg.png");
  });

  test("data: url() in style is untouched", () => {
    const result = scrub('<div style="background: url(data:image/png;base64,abc)">hi</div>');
    expect(result.removed).toHaveLength(0);
    expect(result.html).toContain("data:image/png");
  });
});

describe("scrub — SVG preservation", () => {
  test("fully preserves inline SVG diagram", () => {
    const svg = `<figure class="diagram">
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="40" fill="red"/>
    <text x="50" y="55" text-anchor="middle">Label</text>
  </svg>
  <figcaption>System diagram</figcaption>
</figure>`;
    const result = scrub(svg);
    expect(result.removed).toHaveLength(0);
    expect(result.html).toContain("<circle");
    expect(result.html).toContain("<text");
    expect(result.html).toContain("System diagram");
  });

  test("preserves SVG attributes and classes", () => {
    const result = scrub('<svg class="icon" width="24" height="24"><path d="M0 0"/></svg>');
    expect(result.removed).toHaveLength(0);
    expect(result.html).toContain('class="icon"');
    expect(result.html).toContain('d="M0 0"');
  });
});

describe("scrub — general", () => {
  test("returns ScrubResult with html and removed array", () => {
    const result: ScrubResult = scrub("<p>hello</p>");
    expect(typeof result.html).toBe("string");
    expect(Array.isArray(result.removed)).toBe(true);
  });

  test("multiple removals are all tracked", () => {
    const result = scrub(
      '<script src="http://a.com/x.js"></script>' +
        '<link rel="stylesheet" href="http://b.com/y.css">' +
        '<img src="http://c.com/z.png">',
    );
    expect(result.removed).toHaveLength(3);
  });

  test("passthrough: clean HTML is returned unchanged", () => {
    const clean = '<div class="card"><h2>Hello</h2><p>World</p></div>';
    const result = scrub(clean);
    expect(result.removed).toHaveLength(0);
    expect(result.html).toContain("Hello");
    expect(result.html).toContain("World");
  });

  test("#fragment href on anchor is left alone", () => {
    const result = scrub('<a href="#section-1">Jump</a>');
    expect(result.removed).toHaveLength(0);
    expect(result.html).toContain("#section-1");
  });
});

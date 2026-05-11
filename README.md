# Cesium

Cesium turns substantive opencode agent responses — plans, reviews, comparisons, explainers,
audits, RFCs — into self-contained beautiful HTML artifacts on disk, instead of dumping
markdown into the terminal. The browser becomes the reading surface; the terminal stays the
control surface. Each artifact is a single `.html` file: portable, archivable, viewable
offline, and shareable as a URL over SSH.

**Status: v0.0.0 — under construction. See [ARCHITECTURE.md](ARCHITECTURE.md) for the design.**

---

## Install

Cesium is an opencode plugin. Full install instructions will be documented when v1 ships.
For now, the plugin entry point is `src/index.ts`.

To register it (placeholder — format subject to change):

```json
// ~/.config/opencode/opencode.json
{
  "plugins": ["path/to/cesium/src/index.ts"]
}
```

---

## What it does

- Publishes plans, reviews, comparisons, and reports as self-contained `.html` files to
  `~/.local/state/cesium/projects/<project>/artifacts/`.
- Serves artifacts on `http://localhost:3030` via a lazy-start Bun HTTP server (starts on
  first publish, idles out after 30 minutes).
- Produces portable single-file HTML — no external resources, no internet required.
  Copy a file anywhere and it still looks right.

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for full design: trigger model, tool surface, HTML
strategy, storage layout, index generation, server lifecycle, and revision chains.

---

## License

MIT. See [LICENSE](LICENSE).

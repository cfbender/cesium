# Agents

This file is for AI assistants working on the cesium codebase.

---

## Project layout

```
cesium/
├── src/
│   ├── index.ts          # opencode plugin entry — registers tools + injects prompt fragment
│   ├── config.ts         # config loader (~/.config/opencode/cesium.json)
│   ├── tools/
│   │   ├── publish.ts    # cesium_publish tool handler
│   │   └── styleguide.ts # cesium_styleguide tool handler
│   ├── render/
│   │   ├── theme.ts      # CSS framework + color tokens
│   │   ├── wrap.ts       # assembles full HTML document from body fragment
│   │   ├── scrub.ts      # strips external resources from agent HTML
│   │   └── validate.ts   # validates tool input before write
│   ├── storage/
│   │   ├── paths.ts      # derives state dir, project slug, filenames
│   │   ├── write.ts      # atomic file write (tmp → rename)
│   │   ├── index-cache.ts# reads/writes index.json cache
│   │   ├── index-gen.ts  # generates index.html from cache
│   │   └── lock.ts       # file-lock around index writes
│   ├── server/
│   │   ├── http.ts       # Bun HTTP server (127.0.0.1:3030, rooted at state dir)
│   │   └── lifecycle.ts  # lazy start, idle shutdown, PID file management
│   └── prompt/
│       └── system-fragment.md  # injected into agent sessions with cesium tools
├── assets/               # static assets shipped with the plugin (CSS, etc.)
├── agents/               # optional dedicated cesium agent definition (Phase 5)
├── examples/             # hand-written reference HTML artifacts
├── test/                 # bun test files
├── .specs/               # GITIGNORED scratch — full design in 2026-05-11-cesium-design.md
├── package.json
├── tsconfig.json
├── .oxlintrc.json
└── .gitignore
```

---

## Common commands

```bash
bun install           # install dependencies
bun test              # run test suite
bun run typecheck     # tsc --noEmit
bun run lint          # oxlint
bun run format        # oxfmt .
bun run format:check  # oxfmt --check . (CI-friendly)
```

---

## Code style

- **TypeScript strict mode.** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
  `noImplicitOverride` are all on.
- **Never use** `as any`, `@ts-ignore`, or `@ts-expect-error`. If the types don't fit, fix
  the types. `oxlint` enforces this.
- **Toolchain:** `oxlint` for linting, `oxfmt` for formatting. Both are part of the OXC
  project (Rust-based, fast). Default oxfmt style: 2-space indent, double quotes, trailing
  commas, semicolons, 100-character line width (configured implicitly via oxfmt defaults
  and `package.json`).
- **ESM only.** `"type": "module"` in package.json. Use `.ts` extensions in imports
  (`import { foo } from "./foo.ts"`).

---

## Commit style

Short, imperative, lowercase first word, no emoji. Examples:

- `scaffold cesium v1 plugin project`
- `add storage write with atomic rename`
- `fix idle shutdown timer not resetting on request`

---

## Design reference

Full design synthesis is in `.specs/2026-05-11-cesium-design.md` (gitignored — not checked
in). Read it before working on any non-trivial feature. Each phase of the build corresponds
to one commit/PR; check the git log for the phased history.

---

## Key invariants

- **Strict portability:** generated HTML must never reference external resources. The scrub
  pass in `src/render/scrub.ts` enforces this. Do not weaken it.
- **Atomic writes:** all file writes go through `src/storage/write.ts` (tmp → rename). Never
  write directly to the final path.
- **Metadata travels with the file:** the `<script type="application/json" id="cesium-meta">`
  block inside each artifact is the source of truth. `index.json` is a derived cache.
- **Server binds to 127.0.0.1 only** by default. Do not change this without a config flag.

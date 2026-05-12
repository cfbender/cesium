// Local-dev shim: load the cesium plugin from this repo's source instead of
// the published npm package. opencode auto-loads any .ts file in
// .opencode/plugins/ at startup. Edits to ../../src/* take effect on the
// next opencode session.
export { CesiumPlugin } from "../../src/index.ts";
export { CesiumPlugin as default } from "../../src/index.ts";

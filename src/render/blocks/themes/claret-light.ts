// Claret-light shiki theme — derived from the cesium claret-light palette.
// src/render/blocks/themes/claret-light.ts
//
// Palette source (src/render/theme.ts, "claret-light" preset):
//   codeBg  #180810  — code panel background (uses dark bg even in light theme)
//   codeFg  #DDD3C7  — default text (same as dark — panel is always dark)
//   accent  #8B2252  — deep claret rose (keywords)
//   olive   #5A6B40  — dark olive (strings)
//   muted   #7D7068  — warm taupe (comments)
//   ink     #2A1F1A  — near-black body text
//   inkSoft #5A4D42  — warm brown
//
// The claret-light theme uses the SAME dark code panel as claret-dark
// (codeBg=#180810 / codeFg=#DDD3C7), so token colors are tuned for a
// dark surface but with the light-palette accent/olive/muted values.
//
// Derived values:
//   gold    #D4A85A  — same as dark (hardcoded in .code .fn CSS)
//   teal    #6A9FA8  — slightly darker teal for better contrast on #180810
//   number  #C08048  — warmer amber (deeper than dark variant)
//   regexp  #A87838  — dark gold for regex

import type { ThemeRegistration } from "shiki";

export const claretLight: ThemeRegistration = {
  name: "claret-light",
  type: "light",
  fg: "#DDD3C7",
  bg: "#180810",
  colors: {
    "editor.foreground": "#DDD3C7",
    "editor.background": "#180810",
  },
  tokenColors: [
    // Comments — muted taupe, italic
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: "#7D7068", fontStyle: "italic" },
    },
    // Keywords, storage — deep claret rose
    {
      scope: [
        "keyword",
        "storage.type",
        "storage.modifier",
        "storage.type.function.arrow",
        "keyword.control",
        "keyword.operator.new",
        "keyword.operator.delete",
        "keyword.operator.typeof",
        "keyword.operator.void",
        "keyword.operator.in",
        "keyword.operator.instanceof",
        "keyword.import",
        "keyword.export",
        "constant.language.undefined",
        "constant.language.null",
        "constant.language.boolean",
        "constant.language",
      ],
      settings: { foreground: "#8B2252" },
    },
    // Strings — dark olive
    {
      scope: [
        "string",
        "string.quoted",
        "string.template",
        "attribute.value",
      ],
      settings: { foreground: "#5A6B40" },
    },
    // String delimiters — dimmed olive
    {
      scope: ["punctuation.definition.string"],
      settings: { foreground: "#4E5E37" },
    },
    // Functions / methods — gold
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call entity.name.function",
      ],
      settings: { foreground: "#D4A85A" },
    },
    // Types, interfaces, classes — teal
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "entity.name.interface",
        "support.type",
        "support.class",
        "support.type.primitive",
      ],
      settings: { foreground: "#6A9FA8" },
    },
    // Numbers — warm amber
    {
      scope: ["constant.numeric", "number", "keyword.operator.quantifier.regexp"],
      settings: { foreground: "#C08048" },
    },
    // Variables — soft default fg
    {
      scope: ["variable", "variable.other", "identifier"],
      settings: { foreground: "#BDB3A7" },
    },
    // Parameters — slightly lighter
    {
      scope: ["variable.parameter"],
      settings: { foreground: "#CFC8BE" },
    },
    // Properties / object keys
    {
      scope: [
        "variable.other.property",
        "meta.object-literal.key",
        "meta.property-name",
        "entity.name.tag.yaml",
        "support.type.property-name",
      ],
      settings: { foreground: "#BDB3A7" },
    },
    // Operators and punctuation — muted
    {
      scope: [
        "keyword.operator",
        "keyword.operator.assignment",
        "keyword.operator.arithmetic",
        "keyword.operator.logical",
        "keyword.operator.comparison",
        "keyword.operator.type.annotation",
        "punctuation",
        "meta.brace",
        "delimiter",
        "punctuation.separator",
        "punctuation.terminator",
        "punctuation.accessor",
      ],
      settings: { foreground: "#7D7068" },
    },
    // Regex — dark gold
    {
      scope: ["string.regexp", "source.regexp"],
      settings: { foreground: "#A87838" },
    },
  ],
};

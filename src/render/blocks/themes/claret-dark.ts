// Claret-dark shiki theme — derived from the cesium claret-dark palette.
// src/render/blocks/themes/claret-dark.ts
//
// Palette source (src/render/theme.ts, "claret-dark" preset):
//   codeBg  #2B1F22  — code panel background
//   codeFg  #DDD3C7  — default text
//   accent  #C75B7A  — claret rose (keywords)
//   olive   #8FA86E  — olive green (strings)
//   muted   #9E9288  — warm gray (comments, punctuation)
//   ink     #DDD3C7  — body text = codeFg
//   inkSoft #BDB3A7  — soft ink (variables)
//
// Derived values (not in palette, kept close to existing hues):
//   gold    #D4A85A  — hardcoded in .code .fn CSS — functions/methods
//   teal    #7AAEB5  — desaturated blue-teal (types/interfaces)
//   number  #C99A6E  — warm amber (numbers — between gold and muted)
//   regexp  #B88A4A  — darker gold (regex literals)

import type { ThemeRegistration } from "shiki";

export const claretDark: ThemeRegistration = {
  name: "claret-dark",
  type: "dark",
  fg: "#DDD3C7",
  bg: "#2B1F22",
  colors: {
    "editor.foreground": "#DDD3C7",
    "editor.background": "#2B1F22",
  },
  tokenColors: [
    // Comments — muted gray, italic
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: "#9E9288", fontStyle: "italic" },
    },
    // Keywords, storage — claret rose accent
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
      settings: { foreground: "#C75B7A" },
    },
    // Strings — olive green
    {
      scope: [
        "string",
        "string.quoted",
        "string.template",
        "attribute.value",
      ],
      settings: { foreground: "#8FA86E" },
    },
    // String delimiters — slightly dimmed olive
    {
      scope: ["punctuation.definition.string"],
      settings: { foreground: "#7A9260" },
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
      settings: { foreground: "#7AAEB5" },
    },
    // Numbers — warm amber
    {
      scope: ["constant.numeric", "number", "keyword.operator.quantifier.regexp"],
      settings: { foreground: "#C99A6E" },
    },
    // Variables — soft ink
    {
      scope: ["variable", "variable.other", "identifier"],
      settings: { foreground: "#BDB3A7" },
    },
    // Parameters — slightly lighter
    {
      scope: ["variable.parameter"],
      settings: { foreground: "#CFC8BE" },
    },
    // Properties / object keys — ink-soft with slight gold tint
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
      settings: { foreground: "#9E9288" },
    },
    // Regex — darker gold
    {
      scope: ["string.regexp", "source.regexp"],
      settings: { foreground: "#B88A4A" },
    },
  ],
};

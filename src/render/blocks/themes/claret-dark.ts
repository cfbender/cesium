// Claret-dark shiki theme — converted from ports/bat/ClaretDark.tmTheme.
// src/render/blocks/themes/claret-dark.ts
//
// Source of truth: /claret.nvim/ports/bat/ClaretDark.tmTheme
// Every scope rule in the tmTheme is preserved verbatim; comma-separated
// scope strings are split into the string[] form shiki prefers.
//
// Global tokens (from tmTheme global settings):
//   bg         #180810  — editor background
//   fg         #DDD3C7  — default foreground
//   selection  #2B1F22
//   gutter fg  #71685E
//
// Derived palette reference (claret.nvim/lua/claret/palette.lua — dark):
//   rose_1    #C75B7A   keyword / statement / accent
//   rose_2    #B04A68   property / data keys
//   gold_1    #D4A76A   function / number / constant / decorator
//   sage_1    #8FA86E   string
//   slate_1   #8995A8   type / class / tag / escape / link
//   slate_2   #6E7A90   tag attribute
//   text      #DDD3C7   variable / default fg
//   text_2    #BDB3A7   operator (syntax.lua maps Operator → text_2; tmTheme uses #9E9288)
//             NOTE: the tmTheme uses #9E9288 (text_3) for operator/punctuation — preserved.
//   text_4    #71685E   comment (fg)
//   terra_1   #C44536   invalid / diff deleted

import type { ThemeRegistration } from "shiki";

export const claretDark: ThemeRegistration = {
  name: "claret-dark",
  type: "dark",
  fg: "#DDD3C7",
  bg: "#180810",
  colors: {
    "editor.foreground": "#DDD3C7",
    "editor.background": "#180810",
    "editor.selectionBackground": "#2B1F22",
    "editor.lineHighlightBackground": "#2B1F22",
    "editorLineNumber.foreground": "#71685E",
  },
  tokenColors: [
    // Comment — #71685E italic
    {
      name: "Comment",
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#71685E", fontStyle: "italic" },
    },
    // Keyword — #C75B7A
    {
      name: "Keyword",
      scope: ["keyword", "storage.type", "storage.modifier"],
      settings: { foreground: "#C75B7A" },
    },
    // Function — #D4A76A
    {
      name: "Function",
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "#D4A76A" },
    },
    // String — #8FA86E
    {
      name: "String",
      scope: ["string", "punctuation.definition.string"],
      settings: { foreground: "#8FA86E" },
    },
    // Number — #D4A76A
    {
      name: "Number",
      scope: ["constant.numeric"],
      settings: { foreground: "#D4A76A" },
    },
    // Constant — #D4A76A
    {
      name: "Constant",
      scope: ["constant", "constant.language", "variable.language"],
      settings: { foreground: "#D4A76A" },
    },
    // Type — #8995A8
    {
      name: "Type",
      scope: ["entity.name.type", "entity.name.class", "support.type", "support.class"],
      settings: { foreground: "#8995A8" },
    },
    // Variable — #DDD3C7
    {
      name: "Variable",
      scope: ["variable", "variable.parameter"],
      settings: { foreground: "#DDD3C7" },
    },
    // Parameter — #DDD3C7 italic (overrides Variable for parameters)
    {
      name: "Parameter",
      scope: ["variable.parameter"],
      settings: { foreground: "#DDD3C7", fontStyle: "italic" },
    },
    // Property — #B04A68
    {
      name: "Property",
      scope: ["variable.other.property", "variable.other.member"],
      settings: { foreground: "#B04A68" },
    },
    // JSON/YAML/TOML Keys — #B04A68
    {
      name: "JSON/YAML/TOML Keys",
      scope: [
        "meta.mapping.key string",
        "support.type.property-name.json",
        "punctuation.support.type.property-name.json",
        "support.type.property-name.toml",
        "punctuation.support.type.property-name.toml",
        "entity.name.tag.yaml",
        "support.type.property-name.yaml",
      ],
      settings: { foreground: "#B04A68" },
    },
    // Operator — #9E9288
    {
      name: "Operator",
      scope: ["keyword.operator"],
      settings: { foreground: "#9E9288" },
    },
    // Punctuation — #9E9288
    {
      name: "Punctuation",
      scope: ["punctuation"],
      settings: { foreground: "#9E9288" },
    },
    // Decorator — #D4A76A italic
    {
      name: "Decorator",
      scope: ["meta.decorator", "punctuation.decorator"],
      settings: { foreground: "#D4A76A", fontStyle: "italic" },
    },
    // Tag — #8995A8
    {
      name: "Tag",
      scope: ["entity.name.tag"],
      settings: { foreground: "#8995A8" },
    },
    // Tag Attribute — #6E7A90
    {
      name: "Tag Attribute",
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#6E7A90" },
    },
    // Invalid — #C44536
    {
      name: "Invalid",
      scope: ["invalid", "invalid.illegal"],
      settings: { foreground: "#C44536" },
    },
    // Escape — #8995A8
    {
      name: "Escape",
      scope: ["constant.character.escape"],
      settings: { foreground: "#8995A8" },
    },
    // Markup Heading — #C75B7A bold
    {
      name: "Markup Heading",
      scope: ["markup.heading"],
      settings: { foreground: "#C75B7A", fontStyle: "bold" },
    },
    // Markup Bold — bold (no color override)
    {
      name: "Markup Bold",
      scope: ["markup.bold"],
      settings: { fontStyle: "bold" },
    },
    // Markup Italic — italic (no color override)
    {
      name: "Markup Italic",
      scope: ["markup.italic"],
      settings: { fontStyle: "italic" },
    },
    // Markup Link — #8995A8
    {
      name: "Markup Link",
      scope: ["markup.underline.link", "string.other.link"],
      settings: { foreground: "#8995A8" },
    },
    // Diff Added — #8FA86E
    {
      name: "Diff Added",
      scope: ["markup.inserted"],
      settings: { foreground: "#8FA86E" },
    },
    // Diff Deleted — #C44536
    {
      name: "Diff Deleted",
      scope: ["markup.deleted"],
      settings: { foreground: "#C44536" },
    },
    // Diff Changed — #D4A76A
    {
      name: "Diff Changed",
      scope: ["markup.changed"],
      settings: { foreground: "#D4A76A" },
    },
  ],
};

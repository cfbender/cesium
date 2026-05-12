// Claret-light shiki theme — derived from claret.nvim light palette.
// src/render/blocks/themes/claret-light.ts
//
// Source of truth: /claret.nvim/lua/claret/palette.lua (light section)
// Scope-to-role mapping mirrors ClaretDark.tmTheme exactly; colors
// are substituted from the light palette using the same semantic roles.
//
// Light palette (palette.lua):
//   bg         #F5E6E2   editor background
//   bg_mute    #DDD0CC   selection / line highlight
//   text       #2A1F1A   default fg
//   text_4     #928578   comment / gutter fg
//   rose_1     #B80842   keyword / heading / statement
//   rose_2     #920820   property / data keys
//   gold_1     #946000   function / number / constant / decorator
//   sage_1     #1B5500   string
//   slate_1    #0E3088   type / class / tag / escape / link
//   slate_2    #0A2575   tag attribute
//   terra_1    #D42010   invalid / diff deleted
//
// Role mapping (matching dark tmTheme):
//   Comment       → text_4   #928578   italic
//   Keyword       → rose_1   #B80842
//   Function      → gold_1   #946000
//   String        → sage_1   #1B5500
//   Number        → gold_1   #946000
//   Constant      → gold_1   #946000
//   Type          → slate_1  #0E3088
//   Variable      → text     #2A1F1A
//   Parameter     → text     #2A1F1A   italic
//   Property      → rose_2   #920820
//   Keys          → rose_2   #920820
//   Operator      → text_4   #928578   (text_3 equivalent; nearest warm muted in light palette)
//   Punctuation   → text_4   #928578
//   Decorator     → gold_1   #946000   italic
//   Tag           → slate_1  #0E3088
//   Tag Attribute → slate_2  #0A2575
//   Invalid       → terra_1  #D42010
//   Escape        → slate_1  #0E3088
//   Markup Heading→ rose_1   #B80842   bold
//   Markup Bold   → (no fg)            bold
//   Markup Italic → (no fg)            italic
//   Markup Link   → slate_1  #0E3088
//   Diff Added    → sage_1   #1B5500
//   Diff Deleted  → terra_1  #D42010
//   Diff Changed  → gold_1   #946000

import type { ThemeRegistration } from "shiki";

export const claretLight: ThemeRegistration = {
  name: "claret-light",
  type: "light",
  fg: "#2A1F1A",
  bg: "#F5E6E2",
  colors: {
    "editor.foreground": "#2A1F1A",
    "editor.background": "#F5E6E2",
    "editor.selectionBackground": "#DDD0CC",
    "editor.lineHighlightBackground": "#DDD0CC",
    "editorLineNumber.foreground": "#928578",
  },
  tokenColors: [
    // Comment — #928578 italic
    {
      name: "Comment",
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#928578", fontStyle: "italic" },
    },
    // Keyword — #B80842
    {
      name: "Keyword",
      scope: ["keyword", "storage.type", "storage.modifier"],
      settings: { foreground: "#B80842" },
    },
    // Function — #946000
    {
      name: "Function",
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "#946000" },
    },
    // String — #1B5500
    {
      name: "String",
      scope: ["string", "punctuation.definition.string"],
      settings: { foreground: "#1B5500" },
    },
    // Number — #946000
    {
      name: "Number",
      scope: ["constant.numeric"],
      settings: { foreground: "#946000" },
    },
    // Constant — #946000
    {
      name: "Constant",
      scope: ["constant", "constant.language", "variable.language"],
      settings: { foreground: "#946000" },
    },
    // Type — #0E3088
    {
      name: "Type",
      scope: ["entity.name.type", "entity.name.class", "support.type", "support.class"],
      settings: { foreground: "#0E3088" },
    },
    // Variable — #2A1F1A
    {
      name: "Variable",
      scope: ["variable", "variable.parameter"],
      settings: { foreground: "#2A1F1A" },
    },
    // Parameter — #2A1F1A italic (overrides Variable for parameters)
    {
      name: "Parameter",
      scope: ["variable.parameter"],
      settings: { foreground: "#2A1F1A", fontStyle: "italic" },
    },
    // Property — #920820
    {
      name: "Property",
      scope: ["variable.other.property", "variable.other.member"],
      settings: { foreground: "#920820" },
    },
    // JSON/YAML/TOML Keys — #920820
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
      settings: { foreground: "#920820" },
    },
    // Operator — #928578
    {
      name: "Operator",
      scope: ["keyword.operator"],
      settings: { foreground: "#928578" },
    },
    // Punctuation — #928578
    {
      name: "Punctuation",
      scope: ["punctuation"],
      settings: { foreground: "#928578" },
    },
    // Decorator — #946000 italic
    {
      name: "Decorator",
      scope: ["meta.decorator", "punctuation.decorator"],
      settings: { foreground: "#946000", fontStyle: "italic" },
    },
    // Tag — #0E3088
    {
      name: "Tag",
      scope: ["entity.name.tag"],
      settings: { foreground: "#0E3088" },
    },
    // Tag Attribute — #0A2575
    {
      name: "Tag Attribute",
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#0A2575" },
    },
    // Invalid — #D42010
    {
      name: "Invalid",
      scope: ["invalid", "invalid.illegal"],
      settings: { foreground: "#D42010" },
    },
    // Escape — #0E3088
    {
      name: "Escape",
      scope: ["constant.character.escape"],
      settings: { foreground: "#0E3088" },
    },
    // Markup Heading — #B80842 bold
    {
      name: "Markup Heading",
      scope: ["markup.heading"],
      settings: { foreground: "#B80842", fontStyle: "bold" },
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
    // Markup Link — #0E3088
    {
      name: "Markup Link",
      scope: ["markup.underline.link", "string.other.link"],
      settings: { foreground: "#0E3088" },
    },
    // Diff Added — #1B5500
    {
      name: "Diff Added",
      scope: ["markup.inserted"],
      settings: { foreground: "#1B5500" },
    },
    // Diff Deleted — #D42010
    {
      name: "Diff Deleted",
      scope: ["markup.deleted"],
      settings: { foreground: "#D42010" },
    },
    // Diff Changed — #946000
    {
      name: "Diff Changed",
      scope: ["markup.changed"],
      settings: { foreground: "#946000" },
    },
  ],
};

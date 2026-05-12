// Generates a compact block field reference from the catalog.
// Injected into the system-fragment at plugin load time via placeholder replacement.
// src/prompt/field-reference.ts

import { blockCatalog } from "../render/blocks/catalog.ts";
import type { Block } from "../render/blocks/types.ts";

// ─── Schema → compact field description ──────────────────────────────────────

type SchemaNode = Record<string, unknown>;

function formatFieldType(node: SchemaNode): string {
  if ("const" in node) return `"${String(node["const"])}"`;
  const type = node["type"] as string | undefined;
  if (type === undefined) return "unknown";
  if (type === "string") {
    const enumVals = node["enum"] as string[] | undefined;
    if (enumVals !== undefined) return enumVals.map((e) => `"${e}"`).join(" | ");
    return "string";
  }
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type === "array") {
    const items = node["items"] as SchemaNode | undefined;
    if (items !== undefined) {
      const innerType = items["type"] as string | undefined;
      if (innerType === "object") {
        const props = items["properties"] as Record<string, SchemaNode> | undefined;
        const req = items["required"] as string[] | undefined;
        if (props !== undefined) {
          const fields = Object.entries(props)
            .filter(([k]) => k !== "type")
            .map(([k, v]) => {
              const isRequired = req !== undefined && req.includes(k);
              return `${k}${isRequired ? "" : "?"}: ${formatFieldType(v)}`;
            })
            .join(", ");
          return `[{ ${fields} }]`;
        }
        return "object[]";
      }
      if (innerType === "string") return "string[]";
      return `${innerType ?? "unknown"}[]`;
    }
    return "array";
  }
  if (type === "object") return "object";
  return type;
}

function formatBlockLine(type: Block["type"]): string {
  const entry = blockCatalog[type];
  const schema = entry.schema as SchemaNode;
  const props = schema["properties"] as Record<string, SchemaNode> | undefined;
  const required = schema["required"] as string[] | undefined;

  if (props === undefined) return `- \`${type}\``;

  const fields = Object.entries(props)
    .filter(([k]) => k !== "type")
    .map(([k, v]) => {
      const isRequired = required !== undefined && required.includes(k);
      return `${k}${isRequired ? "" : "?"}: ${formatFieldType(v)}`;
    })
    .join(", ");

  return `- \`${type}\` — ${fields}`;
}

/**
 * Generates a compact markdown block field reference from the catalog.
 * This is injected into system-fragment.md at the {{BLOCK_FIELD_REFERENCE}} placeholder.
 */
export function generateBlockFieldReference(): string {
  const lines = [
    "## Block field reference",
    "",
    "For full schemas with rendered examples, call `cesium_styleguide`. Exact field names:",
    "",
  ];

  for (const type of Object.keys(blockCatalog) as Block["type"][]) {
    lines.push(formatBlockLine(type));
  }

  lines.push("");
  lines.push(
    "All `markdown` fields support `**bold**`, `*italic*`, `` `code` ``, lists, blockquotes, " +
    "and the safelisted inline tags `<kbd>`, `<span class=\"pill\">`, `<span class=\"tag\">`. " +
    "External URLs in links render as plain text.",
  );

  return lines.join("\n");
}

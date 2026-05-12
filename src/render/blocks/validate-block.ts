// Deep per-block field validator — walks catalog schemas and checks field shapes.
// src/render/blocks/validate-block.ts

import { blockCatalog } from "./catalog.ts";

export interface BlockFieldError {
  path: string;
  message: string;
}

// ─── Levenshtein distance (small, iterative) ─────────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  // Use two rows
  let prev = Array.from({ length: bLen + 1 }, (_, i) => i);
  let curr: number[] = Array.from({ length: bLen + 1 }, () => 0);
  for (let i = 1; i <= aLen; i++) {
    curr[0] = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[bLen] ?? 0;
}

/**
 * Given an unknown field name and a list of known field names, returns the
 * closest known name if the Levenshtein distance is ≤ 2, otherwise checks
 * common alias patterns, otherwise returns null.
 */
function didYouMean(unknown: string, known: string[]): string | null {
  // Explicit common aliases that wouldn't be caught by Levenshtein alone
  const ALIASES: Record<string, string> = {
    label: "k",
    value: "v",
    description: "text",
    title: "label",
    med: "medium",
    name: "k",
    key: "k",
    val: "v",
  };

  // Check alias map first
  const aliased = ALIASES[unknown.toLowerCase()];
  if (aliased !== undefined && known.includes(aliased)) {
    return aliased;
  }

  // Fall back to Levenshtein ≤ 2
  let best: string | null = null;
  let bestDist = 3; // threshold: only suggest if distance ≤ 2
  for (const name of known) {
    const d = levenshtein(unknown, name);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

// ─── JSON Schema fragment types ───────────────────────────────────────────────

type SchemaNode =
  | { type: "string"; enum?: string[] }
  | { type: "number" }
  | { type: "boolean" }
  | { type: "array"; items?: SchemaNode }
  | { type: "object"; properties?: Record<string, SchemaNode>; required?: string[] }
  | { const: unknown };

function isSchemaNode(v: unknown): v is SchemaNode {
  return v !== null && typeof v === "object";
}

// ─── Deep validator ───────────────────────────────────────────────────────────

/**
 * Validate a single value against a JSON Schema fragment node.
 * Appends any findings to `errors`. `path` is the dotted path for error messages.
 */
function validateNode(value: unknown, schema: SchemaNode, path: string, errors: BlockFieldError[]): void {
  // const node
  if ("const" in schema) {
    if (value !== schema.const) {
      errors.push({ path, message: `expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}` });
    }
    return;
  }

  const s = schema as Exclude<SchemaNode, { const: unknown }>;

  switch (s.type) {
    case "string": {
      if (typeof value !== "string") {
        errors.push({ path, message: `expected string, got ${typeof value}` });
        return;
      }
      if (s.enum !== undefined && !s.enum.includes(value)) {
        errors.push({
          path,
          message: `invalid value "${value}"; must be one of: ${s.enum.map((e) => `"${e}"`).join(", ")}`,
        });
      }
      return;
    }
    case "number": {
      if (typeof value !== "number") {
        errors.push({ path, message: `expected number, got ${typeof value}` });
      }
      return;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        errors.push({ path, message: `expected boolean, got ${typeof value}` });
      }
      return;
    }
    case "array": {
      if (!Array.isArray(value)) {
        errors.push({ path, message: `expected array, got ${typeof value}` });
        return;
      }
      if (s.items !== undefined) {
        const arr = value as unknown[];
        for (let i = 0; i < arr.length; i++) {
          validateNode(arr[i], s.items, `${path}[${i}]`, errors);
        }
      }
      return;
    }
    case "object": {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        errors.push({ path, message: `expected object, got ${Array.isArray(value) ? "array" : typeof value}` });
        return;
      }
      const obj = value as Record<string, unknown>;
      const props = s.properties ?? {};
      const required = s.required ?? [];
      const knownKeys = Object.keys(props).filter((k) => k !== "type");

      // Only validate required/unknown fields when the schema explicitly defines properties.
      // An empty or missing properties block (e.g. `items: { type: "object" }` for generic
      // child lists) means "accept any object" — don't report unknown fields.
      if (Object.keys(props).length > 0) {
        // Check required fields
        for (const req of required) {
          if (req === "type") continue; // type is already validated by dispatch
          if (!(req in obj)) {
            errors.push({ path: `${path}.${req}`, message: `required field "${req}" is missing` });
          }
        }

        // Check each present field
        for (const [key, val] of Object.entries(obj)) {
          if (key === "type") continue; // skip discriminant
          const propSchema = props[key];
          if (propSchema === undefined) {
            // Unknown field — suggest closest known
            const suggestion = didYouMean(key, knownKeys);
            const suggestionMsg = suggestion !== null ? `; did you mean "${suggestion}"?` : "";
            errors.push({ path: `${path}.${key}`, message: `unknown field "${key}"${suggestionMsg}` });
          } else if (isSchemaNode(propSchema)) {
            validateNode(val, propSchema, `${path}.${key}`, errors);
          }
        }
      }
      return;
    }
  }
}

/**
 * Deeply validates a block's fields against its catalog schema.
 * Returns an array of field errors (empty = valid).
 */
export function deepValidateBlock(block: Record<string, unknown>, path: string): BlockFieldError[] {
  const errors: BlockFieldError[] = [];
  const type = block["type"] as string;
  const catalogEntry = blockCatalog[type as keyof typeof blockCatalog];
  if (catalogEntry === undefined) {
    // Unknown type — already caught by outer validateBlock; skip
    return errors;
  }

  const schema = catalogEntry.schema as SchemaNode;
  validateNode(block, schema, path, errors);

  return errors;
}

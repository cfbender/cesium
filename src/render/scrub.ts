// Strips external resources (remote links, scripts, images) from agent-supplied HTML.

import { parseFragment, serialize, defaultTreeAdapter as ta } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";

type ChildNode = DefaultTreeAdapterTypes.ChildNode;
type Element = DefaultTreeAdapterTypes.Element;

export type ScrubReason = "script-src" | "stylesheet-href" | "img-http" | "url-http";

export interface ScrubRemoval {
  reason: ScrubReason;
  original: string;
}

export interface ScrubResult {
  html: string;
  removed: ScrubRemoval[];
}

const HTTP_RE = /^https?:\/\//i;
const URL_HTTP_RE = /url\(\s*['"]?(https?:\/\/[^)'"]+)['"]?\s*\)/gi;

function attrVal(node: Element, name: string): string | undefined {
  const attr = ta.getAttrList(node).find((a) => a.name === name);
  return attr?.value;
}

function makeComment(text: string): ChildNode {
  return ta.createCommentNode(text) as unknown as ChildNode;
}

function scrubNode(node: ChildNode, removed: ScrubRemoval[]): ChildNode | null {
  if (!ta.isElementNode(node)) return node;
  const el = node as Element;
  const tag = ta.getTagName(el);

  // <script src="..."> — remove any script with a src (local or remote)
  if (tag === "script" && attrVal(el, "src") !== undefined) {
    const src = attrVal(el, "src") ?? "";
    removed.push({ reason: "script-src", original: `<script src="${src}">` });
    return makeComment(` cesium: removed external <script src="${src}"> `);
  }

  // <link rel="stylesheet" href="http...">
  if (tag === "link") {
    const rel = (attrVal(el, "rel") ?? "").toLowerCase();
    const href = attrVal(el, "href") ?? "";
    if (rel === "stylesheet" && HTTP_RE.test(href)) {
      removed.push({
        reason: "stylesheet-href",
        original: `<link rel="stylesheet" href="${href}">`,
      });
      return makeComment(` cesium: removed external <link rel="stylesheet" href="${href}"> `);
    }
  }

  // <img src="http...">
  if (tag === "img") {
    const src = attrVal(el, "src") ?? "";
    if (HTTP_RE.test(src)) {
      removed.push({ reason: "img-http", original: `<img src="${src}">` });
      return makeComment(` cesium: removed external <img src="${src}"> `);
    }
  }

  // Scrub url(http...) from inline style attributes
  const attrs = ta.getAttrList(el);
  for (const attr of attrs) {
    if (attr.name === "style" && URL_HTTP_RE.test(attr.value)) {
      URL_HTTP_RE.lastIndex = 0;
      const newVal = attr.value.replace(URL_HTTP_RE, (_match, url: string) => {
        removed.push({ reason: "url-http", original: `url(${url})` });
        return "url()";
      });
      URL_HTTP_RE.lastIndex = 0;
      attr.value = newVal;
    }
  }

  // Recurse into children
  const children = ta.getChildNodes(el) as ChildNode[];
  const toRemove: number[] = [];
  const replacements: Map<number, ChildNode> = new Map();

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child === undefined) continue;
    const result = scrubNode(child, removed);
    if (result === null) {
      toRemove.push(i);
    } else if (result !== child) {
      replacements.set(i, result);
    }
  }

  // Apply replacements in reverse order to preserve indices
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    if (child === undefined) continue;
    if (toRemove.includes(i)) {
      ta.detachNode(child);
    } else {
      const replacement = replacements.get(i);
      if (replacement !== undefined) {
        ta.insertBefore(el, replacement, child);
        ta.detachNode(child);
      }
    }
  }

  return el as unknown as ChildNode;
}

export function scrub(htmlBody: string): ScrubResult {
  const removed: ScrubRemoval[] = [];
  const fragment = parseFragment(htmlBody);
  const children = ta.getChildNodes(fragment) as ChildNode[];

  const toDetach: ChildNode[] = [];
  const toReplace: Array<{ old: ChildNode; replacement: ChildNode }> = [];

  for (const child of children) {
    const result = scrubNode(child, removed);
    if (result === null) {
      toDetach.push(child);
    } else if (result !== child) {
      toReplace.push({ old: child, replacement: result });
    }
  }

  for (const { old, replacement } of toReplace) {
    ta.insertBefore(fragment, replacement, old);
    ta.detachNode(old);
  }
  for (const node of toDetach) {
    ta.detachNode(node);
  }

  return { html: serialize(fragment), removed };
}

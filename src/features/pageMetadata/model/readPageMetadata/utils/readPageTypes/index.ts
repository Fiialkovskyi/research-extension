import { PAGE_TYPE_LIMIT, PAGE_TYPES_MAXIMUM } from "../../../../constants";
import { cleanText } from "../cleanText";
import { readJsonLd } from "../readJsonLd";

/** How deep into nested markup a type is looked for. */
const MAXIMUM_DEPTH = 6;

/** Adds the `@type` names of a node and of everything inside it, in the order met. */
const collectTypes = (value: unknown, found: Set<string>, depth: number): void => {
  if (depth > MAXIMUM_DEPTH || found.size >= PAGE_TYPES_MAXIMUM) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTypes(item, found, depth + 1);
    }

    return;
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  const record = value as Record<string, unknown>;
  const type = record["@type"];

  for (const name of Array.isArray(type) ? type : [type]) {
    const text = typeof name === "string" ? cleanText(name, PAGE_TYPE_LIMIT) : undefined;

    if (text !== undefined && found.size < PAGE_TYPES_MAXIMUM) {
      found.add(text);
    }
  }

  for (const inner of Object.values(record)) {
    collectTypes(inner, found, depth + 1);
  }
};

/**
 * Reads the schema.org `@type` names the page's JSON-LD declares, however deep
 * in its graph: a `Product`, the `Offer` inside it, a `Review`. At most eight,
 * each cut to its limit, in the order met, without repeats. Nothing is read from
 * the page's text.
 *
 * Runs in the page and changes nothing in it.
 *
 * @returns The names, or `undefined` when the page declares none.
 */
export const readPageTypes = (document: Document): string[] | undefined => {
  const found = new Set<string>();

  for (const root of readJsonLd(document)) {
    collectTypes(root, found, 0);
  }

  return found.size === 0 ? undefined : [...found];
};

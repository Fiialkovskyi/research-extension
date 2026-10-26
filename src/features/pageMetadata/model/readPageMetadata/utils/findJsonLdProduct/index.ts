/** How deep into nested markup a product is looked for. */
const MAXIMUM_DEPTH = 6;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a node's `@type` is, or lists, `Product`. */
const isProduct = (node: Record<string, unknown>): boolean => {
  const type = node["@type"];

  return type === "Product" || (Array.isArray(type) && type.includes("Product"));
};

/**
 * Finds the first `Product` in parsed JSON-LD: the value itself, an item of an
 * array, or a node of an `@graph`, however nested up to a few levels.
 *
 * @returns The product's node, or `undefined`.
 */
export const findJsonLdProduct = (
  value: unknown,
  depth = 0,
): Record<string, unknown> | undefined => {
  if (depth > MAXIMUM_DEPTH) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJsonLdProduct(item, depth + 1);

      if (found !== undefined) {
        return found;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (isProduct(value)) {
    return value;
  }

  return findJsonLdProduct(value["@graph"], depth + 1);
};

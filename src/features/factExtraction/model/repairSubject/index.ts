import { normalizeEntityName } from "@/shared/normalizeEntityName";

/** The character pairs of a name, the unit a small model's slips are measured in. */
const readBigrams = (text: string): Set<string> =>
  new Set(
    Array.from({ length: Math.max(0, text.length - 1) }, (_, index) =>
      text.slice(index, index + 2),
    ),
  );

/** How much of a subject's own text the product's name holds, from 0 to 1. */
const readContainment = (subject: string, name: string): number => {
  const bigrams = readBigrams(subject);
  const held = readBigrams(name);

  return bigrams.size === 0
    ? 0
    : [...bigrams].filter((pair) => held.has(pair)).length / bigrams.size;
};

/** The share of a subject's character pairs the page's product name must hold to be taken for it. */
const MINIMUM_CONTAINMENT = 0.85;

/**
 * Gives a subject the page's product name when the model garbled it: a word of the subject is not a
 * word of the name (`Pixel 1: 10 Pro`, `Watch 38/4`) yet nearly all its text is. A subject whose
 * every word is one of the name's is a real, shorter name (`Pixel 10` against `Pixel 10 Pro`) and is
 * left alone, as is any subject when the page names no product.
 */
export const repairSubject = (subject: string, productName: string | undefined): string => {
  if (productName === undefined) {
    return subject;
  }

  const name = normalizeEntityName(productName);
  const normalized = normalizeEntityName(subject);
  const words = new Set(name.split(" "));

  if (normalized === name || normalized.split(" ").every((word) => words.has(word))) {
    return subject;
  }

  return readContainment(normalized, name) >= MINIMUM_CONTAINMENT ? productName : subject;
};

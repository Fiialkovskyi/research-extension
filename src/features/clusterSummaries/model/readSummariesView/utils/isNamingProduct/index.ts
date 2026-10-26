import { normalizeEntityName } from "@/shared/normalizeEntityName";

/** Words of a name, normalised: `Google Pixel 10a` as `google`, `pixel`, `10a`. */
const readWords = (text: string): string[] => normalizeEntityName(text).split(" ").filter(Boolean);

/**
 * Whether a statement names a product: it holds the product's name, or — since
 * a shop's name for a product is long and a claim says `Pixel 10a` — two words
 * of it in a row, or the whole name when it is one word. Compared normalised,
 * so case, punctuation and spacing do not matter.
 */
export const isNamingProduct = (statement: string, productName: string): boolean => {
  const name = readWords(productName);
  const padded = ` ${readWords(statement).join(" ")} `;

  if (name.length === 0) {
    return false;
  }

  if (name.length === 1) {
    return padded.includes(` ${name[0]} `);
  }

  return name.slice(0, -1).some((word, index) => padded.includes(` ${word} ${name[index + 1]} `));
};

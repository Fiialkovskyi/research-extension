import { ATTRIBUTE_SYNONYMS } from "@/shared/config";

/**
 * Whether a column key names a thing one product comes in several of — a
 * storage size, a colour — so that several values in it are options, not a
 * disagreement.
 */
export const isVariantAttributeKey = (key: string): boolean =>
  ATTRIBUTE_SYNONYMS.some((entry) => entry.key === key && entry.variant === true);

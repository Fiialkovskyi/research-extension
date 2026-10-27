import { isKnownUnit } from "@/features/entityResolution";

/** A number at the start of a subject, and the first word after it (a unit sticks to its number or not). */
const LEADING_QUANTITY = /^\d+(?:[.,]\d+)?\s*([^\s\d]+)/u;

/** A value with its spaces and case set aside, so `256 GB` and `256gb` compare equal. */
const squash = (text: string): string => text.replaceAll(/\s+/gu, "").toLowerCase();

/**
 * Whether a fact's subject cannot be a thing the page is about: it is empty,
 * has no letter in it (`27`), is the fact's own value (`256GB` for `256` `GB`),
 * or begins with a number and a unit the value normaliser knows
 * (`6,3″ Super Retina XDR`). A subject that merely begins with a number, like
 * `3M Scotch` or `7-Zip`, is not implausible (nor is a single letter after the
 * number), and neither is one with a unit
 * the normaliser does not know — the prompt is the defence there.
 */
export const isImplausibleSubject = ({
  subject,
  value,
  unit,
}: {
  subject: string;
  value: string;
  unit?: string | undefined;
}): boolean => {
  const trimmed = subject.trim();
  const word = LEADING_QUANTITY.exec(trimmed)?.[1];

  // A single letter after a number (`3M`, `7Z`) is a name far more often than a unit.
  const isUnit = word !== undefined && !/^\p{L}$/u.test(word) && isKnownUnit(word);

  if (!/\p{L}/u.test(trimmed) || isUnit) {
    return true;
  }

  const squashed = squash(trimmed);

  return squashed === squash(value) || squashed === squash(`${value}${unit ?? ""}`);
};

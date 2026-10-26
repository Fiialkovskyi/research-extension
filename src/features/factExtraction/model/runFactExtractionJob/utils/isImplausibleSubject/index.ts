/** Units of measure a spec sheet gives, in the languages the pages come in. */
const UNITS = [
  "″",
  '"',
  "mm",
  "мм",
  "cm",
  "см",
  "GB",
  "ГБ",
  "TB",
  "ТБ",
  "MP",
  "Мп",
  "mAh",
  "мАг",
  "W",
  "Вт",
  "Hz",
  "Гц",
  "cd/m²",
  "кд/м²",
  "hours",
  "годин",
  "min",
  "хв",
];

/** A number, then a unit that ends there: `6,3″` and `256 GB` begin one; `3M` and `20 Minutes` do not. */
const NUMBER_WITH_UNIT = new RegExp(
  `^\\d+(?:[.,]\\d+)?\\s*(?:${UNITS.map((unit) => unit.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)).join("|")})(?![\\p{L}\\p{N}])`,
  "iu",
);

/** A value with its spaces and case set aside, so `256 GB` and `256gb` compare equal. */
const squash = (text: string): string => text.replaceAll(/\s+/gu, "").toLowerCase();

/**
 * Whether a fact's subject cannot be a thing the page is about: it is empty,
 * has no letter in it (`27`), is the fact's own value (`256GB` for `256` `GB`),
 * or begins with a number and a unit of measure (`6,3″ Super Retina XDR`).
 * A subject that merely begins with a number, like `3M Scotch` or `7-Zip`, is
 * not implausible.
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

  if (!/\p{L}/u.test(trimmed) || NUMBER_WITH_UNIT.test(trimmed)) {
    return true;
  }

  const squashed = squash(trimmed);

  return squashed === squash(value) || squashed === squash(`${value}${unit ?? ""}`);
};

import { NORMALIZED_UNITS } from "../../constants";

/**
 * Whether `unit`, spelled as a page writes it, is one `readNormalizedValue`
 * knows: case, spaces, dots and `·` do not matter, and the typographic inch
 * mark `″` counts as `"`.
 */
export const isKnownUnit = (unit: string): boolean =>
  Object.hasOwn(
    NORMALIZED_UNITS,
    unit
      .normalize("NFKC")
      .replaceAll("′′", '"')
      .toLocaleLowerCase("und")
      .replaceAll(/[\s.·*]/gu, ""),
  );

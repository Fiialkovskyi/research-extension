import { NORMALIZED_UNITS } from "../../constants";

/** A value in its base unit, comparable with others of the same unit. */
export interface NormalizedValue {
  number: number;
  unit: string;
}

/** Writes a unit the way the table spells it: lower case, no spaces or dots, `·` dropped. */
const readUnitKey = (unit: string): string =>
  unit
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replaceAll(/[\s.·*]/gu, "");

/**
 * Reads the number a value writes. Spaces are thousands separators; with both
 * a point and a comma the last one is the decimal separator; a lone comma
 * followed by exactly three digits groups thousands, any other is decimal.
 */
const readNumber = (value: string): number | undefined => {
  const compact = value.replaceAll(/[\s  ]/gu, "");

  if (!/^[+-]?[\d.,]+$/u.test(compact) || !/\d/u.test(compact)) {
    return undefined;
  }

  const lastPoint = compact.lastIndexOf(".");
  const lastComma = compact.lastIndexOf(",");
  let decimal: "." | "," | undefined;

  if (lastPoint !== -1 && lastComma !== -1) {
    decimal = lastPoint > lastComma ? "." : ",";
  } else if (lastComma !== -1) {
    const commas = compact.split(",").length - 1;

    decimal = commas === 1 && !/,\d{3}$/u.test(compact) ? "," : undefined;
  } else if (lastPoint !== -1) {
    const points = compact.split(".").length - 1;

    decimal = points === 1 ? "." : undefined;
  }

  const plain =
    decimal === undefined
      ? compact.replaceAll(/[.,]/gu, "")
      : compact.replaceAll(decimal === "," ? "." : ",", "").replace(decimal, ".");
  const number = Number(plain);

  return Number.isFinite(number) ? number : undefined;
};

/**
 * Reads a fact's value into its base unit (`unitNormalizer@1`): mass in kg,
 * length in mm, distance in km, energy in Wh, power in W, torque in N·m, time
 * in s, storage in GB. Percentages and currency codes keep their unit, as does
 * a unit the table does not know; a value that is not a number has no
 * normalised form.
 *
 * @returns The normalised value, or `undefined` when the value is not a number.
 */
export const readNormalizedValue = (
  value: string,
  unit: string | undefined,
): NormalizedValue | undefined => {
  const number = readNumber(value);

  if (number === undefined) {
    return undefined;
  }

  if (unit === undefined || unit.trim() === "") {
    return { number, unit: "" };
  }

  const known = NORMALIZED_UNITS[readUnitKey(unit)];

  if (known === undefined) {
    return {
      number,
      unit: /^[a-z]{3}$/iu.test(unit.trim()) ? unit.trim().toUpperCase() : unit.trim(),
    };
  }

  // Rounded to absorb binary error, e.g. 13 × 25.4 = 330.20000000000005.
  return { number: Number((number * known.factor).toPrecision(12)), unit: known.unit };
};

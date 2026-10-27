/** A number and the word after it, the way a value carries its own unit. */
const VALUE_WITH_UNIT = /^(.*\d)\s*\p{L}[\p{L}./²³]*$/u;

/**
 * Keeps a unit in one place. A value that ends in a unit word while the fact also has a `unit` loses
 * the word (`177 г` with unit `г` is `177`), and an empty unit is no unit.
 */
export const stripRepeatedUnit = ({
  value,
  unit,
}: {
  value: string;
  unit?: string | undefined;
}): { value: string; unit?: string } => {
  const trimmed = unit?.trim();

  if (trimmed === undefined || trimmed === "") {
    return { value };
  }

  return { value: VALUE_WITH_UNIT.exec(value.trim())?.[1] ?? value, unit: trimmed };
};

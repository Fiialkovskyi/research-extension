import { readNormalizedValue } from "@/features/entityResolution";
import { normalizeEntityName } from "@/shared/normalizeEntityName";

import { VALUE_TOLERANCE } from "../../constants";

/** A value as a fact states it. */
export interface StatedValue {
  value: string;
  unit?: string;
}

/**
 * Whether two stated values say the same thing (REQ-SYN-006): numbers in the
 * same base unit at most {@link VALUE_TOLERANCE} of the larger apart, after
 * `unitNormalizer@1`; or text equal once normalised. A number never agrees
 * with text, nor two numbers in different units.
 */
export const isSameValue = (first: StatedValue, second: StatedValue): boolean => {
  const a = readNormalizedValue(first.value, first.unit);
  const b = readNormalizedValue(second.value, second.unit);

  if (a !== undefined || b !== undefined) {
    return (
      a !== undefined &&
      b !== undefined &&
      a.unit === b.unit &&
      Math.abs(a.number - b.number) <=
        VALUE_TOLERANCE * Math.max(Math.abs(a.number), Math.abs(b.number))
    );
  }

  const text = (stated: StatedValue) => normalizeEntityName(`${stated.value} ${stated.unit ?? ""}`);

  return text(first) === text(second);
};

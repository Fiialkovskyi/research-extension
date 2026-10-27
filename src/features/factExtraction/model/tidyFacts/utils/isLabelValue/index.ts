import { normalizeEntityName } from "@/shared/normalizeEntityName";

/**
 * Whether a fact's value is only a label: the attribute of another fact of the same answer. A table the page shows without its values reads that way (`Display type` over
 * `Display type`, `SIM format` over `Connection type`), and a row that states no value states no fact.
 *
 * @param isOtherAttribute Whether a normalised name is the attribute of another fact of the answer.
 */
export const isLabelValue = (
  { value }: { value: string },
  isOtherAttribute: (name: string) => boolean,
): boolean => {
  const normalized = normalizeEntityName(value);

  return normalized !== "" && isOtherAttribute(normalized);
};

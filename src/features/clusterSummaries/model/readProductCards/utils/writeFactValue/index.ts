import type { SummaryFact } from "../../../../types";

/** A fact's value as the page wrote it: the number or text, then its unit. */
export const writeFactValue = ({ value, unit }: Pick<SummaryFact, "value" | "unit">): string =>
  unit === undefined || unit.trim() === "" ? value : `${value} ${unit}`;

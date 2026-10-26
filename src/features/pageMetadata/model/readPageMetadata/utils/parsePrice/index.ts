import { PRODUCT_MAXIMUM_PRICE } from "../../../../constants";

/**
 * Reads a price a page wrote — a number, or text such as `24399`, `24 399` or
 * `24399,50` — as a number.
 *
 * @returns The price, or `undefined` when it is not a finite number above zero
 *   and below a billion.
 */
export const parsePrice = (value: unknown): number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") {
    return undefined;
  }

  const price =
    typeof value === "number" ? value : Number(value.replaceAll(/\s/gu, "").replace(",", "."));

  return Number.isFinite(price) && price > 0 && price < PRODUCT_MAXIMUM_PRICE ? price : undefined;
};

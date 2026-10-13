import * as v from "valibot";

/** What an extraction probe's answer must be; mirrors `EXTRACTED_PRODUCT_JSON_SCHEMA`. */
export const extractedProductSchema = v.object({
  name: v.string(),
  priceUsd: v.number(),
  weightKg: v.number(),
});

import * as v from "valibot";

import {
  METADATA_AUTHOR_LIMIT,
  METADATA_CANONICAL_URL_LIMIT,
  METADATA_DESCRIPTION_LIMIT,
  METADATA_PUBLISHED_AT_LIMIT,
  METADATA_SITE_NAME_LIMIT,
  METADATA_TITLE_LIMIT,
  METADATA_TYPE_LIMIT,
  PRODUCT_AVAILABILITY_LIMIT,
  PRODUCT_BRAND_LIMIT,
  PRODUCT_MAXIMUM_PRICE,
  PRODUCT_NAME_LIMIT,
} from "./constants";

/**
 * The main product a page describes in its markup. Every field is optional:
 * a page gives what it gives, and a field that does not fit is left out.
 */
export const pageProductSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(PRODUCT_NAME_LIMIT))),
  brand: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(PRODUCT_BRAND_LIMIT))),
  price: v.optional(v.pipe(v.number(), v.finite(), v.gtValue(0), v.ltValue(PRODUCT_MAXIMUM_PRICE))),
  /** An ISO 4217 code such as `UAH`. */
  currency: v.optional(v.pipe(v.string(), v.regex(/^[A-Z]{3}$/u))),
  /** The last part of the availability, such as `InStock`. */
  availability: v.optional(
    v.pipe(v.string(), v.minLength(1), v.maxLength(PRODUCT_AVAILABILITY_LIMIT)),
  ),
  ratingValue: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100))),
  ratingCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
});

/**
 * What a page says about itself, as its script sends it. The limits repeat the
 * ones the page applies: a page can send anything, so the background holds it
 * to them again.
 */
export const pageMetadataSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(METADATA_TITLE_LIMIT))),
  description: v.optional(
    v.pipe(v.string(), v.minLength(1), v.maxLength(METADATA_DESCRIPTION_LIMIT)),
  ),
  siteName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(METADATA_SITE_NAME_LIMIT))),
  type: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(METADATA_TYPE_LIMIT))),
  author: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(METADATA_AUTHOR_LIMIT))),
  publishedAt: v.optional(
    v.pipe(v.string(), v.minLength(1), v.maxLength(METADATA_PUBLISHED_AT_LIMIT)),
  ),
  canonicalUrl: v.optional(
    v.pipe(v.string(), v.url(), v.maxLength(METADATA_CANONICAL_URL_LIMIT), v.regex(/^https?:/u)),
  ),
  product: v.optional(pageProductSchema),
});

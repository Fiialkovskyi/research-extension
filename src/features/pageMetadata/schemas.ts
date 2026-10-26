import * as v from "valibot";

import {
  METADATA_AUTHOR_LIMIT,
  METADATA_CANONICAL_URL_LIMIT,
  METADATA_DESCRIPTION_LIMIT,
  METADATA_PUBLISHED_AT_LIMIT,
  METADATA_SITE_NAME_LIMIT,
  METADATA_TITLE_LIMIT,
  METADATA_TYPE_LIMIT,
} from "./constants";

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
});

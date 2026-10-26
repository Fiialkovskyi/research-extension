/** The most characters of each field kept, so a page cannot send an unbounded one. */
export const METADATA_TITLE_LIMIT = 300;
export const METADATA_DESCRIPTION_LIMIT = 1000;
export const METADATA_SITE_NAME_LIMIT = 100;
export const METADATA_TYPE_LIMIT = 50;
export const METADATA_AUTHOR_LIMIT = 200;
export const METADATA_PUBLISHED_AT_LIMIT = 64;
export const METADATA_CANONICAL_URL_LIMIT = 2048;

/** What is read of a page's product: how many JSON-LD scripts, how long each, how long each text. */
export const PRODUCT_MAXIMUM_SCRIPTS = 8;
export const PRODUCT_MAXIMUM_SCRIPT_LENGTH = 200_000;
export const PRODUCT_NAME_LIMIT = 300;
export const PRODUCT_BRAND_LIMIT = 100;
export const PRODUCT_AVAILABILITY_LIMIT = 40;
/** A price is a finite number above zero and below this. */
export const PRODUCT_MAXIMUM_PRICE = 1_000_000_000;

/** The schema.org types a page declares: how many are kept, how long each name. */
export const PAGE_TYPES_MAXIMUM = 8;
export const PAGE_TYPE_LIMIT = 40;

import type * as v from "valibot";

import type { pageMetadataSchema } from "./schemas";

/** What a page says about itself in its head; every field is optional. */
export type PageMetadata = v.InferOutput<typeof pageMetadataSchema>;

/** What names a page as a source: its site and the day it was published, each when known. */
export interface PageSourceDetails {
  siteName?: string;
  /** The UTC calendar day, as `2026-05-01`; only when the page's date parsed and was plausible. */
  publishedDate?: string;
  /** The same moment in epoch milliseconds, for comparing sources. */
  publishedTime?: number;
}

import type * as v from "valibot";

import type { pageMetadataSchema } from "./schemas";

/** What a page says about itself in its head; every field is optional. */
export type PageMetadata = v.InferOutput<typeof pageMetadataSchema>;

/** What a page says about itself in its head, and how it is read and kept. */

// `model/readPageMetadata` is deliberately absent from this barrel: it runs in
// the page, and the background, which imports feature barrels, has no use for
// it. The content script imports it by path.

export { pageMetadataSchema } from "./schemas";
export type { PageMetadata, PageSourceDetails } from "./types";
export { recordPageMetadata, type RecordedMetadata } from "./model/recordPageMetadata";
export { readStoredPageMetadata, type ReadPageMetadata } from "./model/readStoredPageMetadata";
export { readPageSourceDetails } from "./model/readPageSourceDetails";

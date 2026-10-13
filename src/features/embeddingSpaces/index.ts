/**
 * Embedding spaces and their disk use (REQ-LIN-004): a space a model swap
 * retired keeps its vectors for 14 days, or until the user removes it.
 */

// `ui/` is deliberately absent from this barrel: the background imports
// feature barrels and has no use for React. Surfaces import components by path.

export { SPACE_RETENTION_MS } from "./constants";
export { embeddingSpaceRequestSchemas, embeddingSpaceResponseSchemas } from "./schemas";
export type { SpaceUsage } from "./types";
export { purgeRetiredSpaces } from "./model/purgeRetiredSpaces";
export { readSpaceUsage } from "./model/readSpaceUsage";
export { removeSpace } from "./model/removeSpace";

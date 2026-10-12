/** The map page inside the package. */
export const MAP_PAGE_PATH = "map.html";

/**
 * How long the map may take to show a change the background recorded. The
 * research-map spec requires one second.
 */
export const MAP_UPDATE_TIMEOUT_MS = 1000;

/**
 * Window property the reader sets once per document. A later read that finds a
 * different value read a reloaded page, so the map did not update in place.
 */
export const MAP_DOCUMENT_KEY = "__researchMapDocumentId";

/** Window property holding when the number of drawn nodes last changed, in epoch ms. */
export const MAP_NODES_CHANGED_KEY = "__researchMapNodesChangedAt";

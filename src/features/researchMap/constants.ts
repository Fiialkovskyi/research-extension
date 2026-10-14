/** The map page inside the package, as WXT builds `entrypoints/map/`. */
export const MAP_PAGE_PATH = "/map.html";

/**
 * The box every node is laid out in. Fixed rather than measured: the layout
 * runs before anything is rendered, and equal boxes keep the ranks aligned.
 */
export const MAP_NODE_WIDTH = 240;
export const MAP_NODE_HEIGHT = 64;

/** Horizontal space between neighbouring nodes of one rank. */
export const MAP_NODE_SEPARATION = 32;

/** Vertical space between a node and the nodes reached from it. */
export const MAP_RANK_SEPARATION = 56;

/**
 * The map's views, in the order the switcher shows them and the keys 1–4 pick
 * them.
 */
export const MAP_VIEWS = ["history", "tree", "anchors", "telemetry"] as const;

/** The view a map opens in when its address names none. */
export const DEFAULT_MAP_VIEW = "tree";

/**
 * How much of a page's captured text the telemetry view's tooltip shows. A
 * preview, not the page: the full text is on "What was recorded".
 */
export const MAP_EXCERPT_CHARACTERS = 600;

/**
 * The most clusters the telemetry view colours one by one: one per slot of
 * the categorical palette. Further clusters share a neutral "Other".
 */
export const TIMELINE_CLUSTER_SLOTS = 8;

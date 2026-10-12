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

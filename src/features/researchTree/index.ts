/**
 * The research tree: the active session's pages arranged by how the user
 * reached them, shown in the popup with each page's engagement and an unread
 * queue.
 *
 * The components are not exported here; the popup imports them from `ui/` by
 * path, so nothing that imports this barrel bundles React.
 */

export { buildResearchTree, UNCLUSTERED_ROW_ID } from "./model/buildResearchTree";
export type { TreeRow } from "./model/buildResearchTree";
export { listUnreadPages } from "./model/listUnreadPages";
export { listVisibleRows } from "./model/listVisibleRows";
export type { VisibleRow } from "./model/listVisibleRows";
export { moveTreeFocus } from "./model/moveTreeFocus";
export type { TreeFocus, TreeKey } from "./model/moveTreeFocus";

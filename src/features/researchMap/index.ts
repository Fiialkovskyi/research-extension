/**
 * The research map: the active session's graph drawn on a page of its own, so
 * the user can see what capture recorded and return to a page's tab from it.
 *
 * The background builds the snapshot the map draws; the map lays it out and
 * renders it. Nothing here writes.
 */

// Two modules are deliberately absent from this barrel. `ui/` renders with
// React Flow, and `model/buildMapLayout` imports dagre; the background imports
// this barrel for the message schemas and must bundle neither. The map's
// composition root imports both by path.

export { MAP_PAGE_PATH } from "./constants";
export {
  graphSnapshotSchema,
  researchMapRequestSchemas,
  researchMapResponseSchemas,
} from "./schemas";
export type {
  GraphSnapshot,
  MapEdge,
  MapNode,
  ResearchMapRequestType,
  ResearchMapResponseType,
} from "./types";
export { buildGraphSnapshot } from "./model/buildGraphSnapshot";
export { openMapTab } from "./model/openMapTab";
export type { MapTab, MapTabApi } from "./model/openMapTab";
export { readMapTab } from "./model/readMapTab";

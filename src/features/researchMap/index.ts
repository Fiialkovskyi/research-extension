/**
 * The research map: the active session's graph drawn on a page of its own, so
 * the user can see what capture recorded and return to a page's tab from it.
 *
 * The background builds the snapshot the map draws; the map lays it out and
 * renders it. Nothing here writes.
 */

// Some modules are deliberately absent from this barrel. `ui/` renders with
// React Flow, and `model/buildMapLayout` and `model/buildAnchorLayout` import
// dagre; the background imports this barrel for the message schemas and must
// bundle neither. The map's views are pure functions of a snapshot, used only
// by the map page, so its composition root imports them by path too.

export { MAP_EXCERPT_CHARACTERS, MAP_PAGE_PATH } from "./constants";
export {
  graphSnapshotSchema,
  researchMapRequestSchemas,
  researchMapResponseSchemas,
} from "./schemas";
export type {
  GraphSnapshot,
  MapActivity,
  MapCluster,
  MapEdge,
  MapNode,
  MapView,
  ResearchMapRequestType,
  ResearchMapResponseType,
} from "./types";
export { buildGraphSnapshot } from "./model/buildGraphSnapshot";
export { openMapTab } from "./model/openMapTab";
export type { MapTab, MapTabApi } from "./model/openMapTab";
export { readMapTab } from "./model/readMapTab";

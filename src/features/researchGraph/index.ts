/**
 * The research graph: the pages a session visited and how the user moved
 * between them, kept in the database so it outlives the background event page.
 *
 * Stores observed facts only. The engagement state and child counts are
 * derived from what is stored, where they are needed, so a change in the rules
 * never requires rewriting records.
 *
 * Nothing here captures; the capture change calls these functions from the
 * browser's tab and navigation events.
 */

export type { NewEdge, NewNode, SessionGraph, SignalObservation } from "./types";
export { addNodeSignals } from "./model/addNodeSignals";
export { closeNode } from "./model/closeNode";
export { countSessionNodes } from "./model/countSessionNodes";
export { readSessionGraph } from "./model/readSessionGraph";
export { readTabNode } from "./model/readTabNode";
export { recordEdge } from "./model/recordEdge";
export { recordNode } from "./model/recordNode";
export { updateNodeTitle } from "./model/updateNodeTitle";

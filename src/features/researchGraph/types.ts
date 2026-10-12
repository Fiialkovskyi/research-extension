import type { StoredEdge, StoredNode, StoredNodeSignals } from "@/shared/storage";

/** What capture knows about a page when it first records it. */
export type NewNode = Omit<
  StoredNode,
  "id" | "signals" | "tabState" | "createdAt" | "lastFocusedAt"
>;

/** A relation to record; its id and time are filled in. */
export type NewEdge = Omit<StoredEdge, "id" | "createdAt">;

/**
 * New observations about a page. Counts and dwell are increments; scroll and
 * focus time are readings, of which the node keeps the largest.
 */
export type SignalObservation = Partial<StoredNodeSignals> & { lastFocusedAt?: number };

/** A session's graph, read at one moment. */
export interface SessionGraph {
  nodes: StoredNode[];
  edges: StoredEdge[];
}

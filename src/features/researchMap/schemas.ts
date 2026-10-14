import * as v from "valibot";

import { ENGAGEMENT_STATES } from "@/shared/config";

/** A page of the graph, reduced to what the map draws. */
export const mapNodeSchema = v.object({
  id: v.string(),
  title: v.string(),
  url: v.string(),
  domain: v.string(),
  /** `serp` for a search engine's results page, which carries its `query`. */
  kind: v.picklist(["serp", "page"]),
  query: v.optional(v.string()),
  tabId: v.number(),
  tabState: v.picklist(["open", "closed"]),
  /** Derived from the node's signals by `engagement_rules@1`; never stored. */
  engagement: v.picklist(ENGAGEMENT_STATES),
  /** Copies the user made from the page: the sidebar marks a page copied from. */
  copyEvents: v.number(),
  /** Pastes the user made into the page: the anchor view marks a page written in. */
  pasteEvents: v.number(),
  /** Active reading time, which sizes a page in the anchor view. */
  activeDwellMs: v.number(),
  /** Times the page was focused, and returned to after being read. */
  focusCount: v.number(),
  revisitCount: v.number(),
  parentNodeId: v.nullable(v.string()),
  openerNodeId: v.nullable(v.string()),
  transitionType: v.string(),
  createdAt: v.number(),
});

/** A relation between two drawn pages. */
export const mapEdgeSchema = v.object({
  id: v.string(),
  from: v.string(),
  to: v.string(),
  /** Free text rather than a list: a kind this build does not style is still drawn. */
  kind: v.string(),
});

/** A group of pages clustering found, by the ids of its pages. */
export const mapClusterSchema = v.object({
  id: v.string(),
  label: v.string(),
  memberIds: v.array(v.string()),
});

/**
 * A moment of the session's activity: an interval of reading a page, or a copy
 * or paste on it. Times only; what was read, copied or pasted is not sent.
 */
export const mapActivitySchema = v.object({
  nodeId: v.string(),
  kind: v.picklist(["focus", "copy", "paste"]),
  at: v.number(),
  /** When a reading interval ended; equal to `at` for a copy or paste. */
  endAt: v.number(),
});

/** The active session's graph at one moment, or no session and nothing to draw. */
export const graphSnapshotSchema = v.object({
  session: v.nullable(v.object({ id: v.string(), title: v.string() })),
  nodes: v.array(mapNodeSchema),
  edges: v.array(mapEdgeSchema),
  /** The session's latest clusters; empty before it is first clustered. */
  clusters: v.array(mapClusterSchema),
  /** The session's activity, earliest first; empty before it was first logged. */
  activity: v.array(mapActivitySchema),
});

export const researchMapRequestSchemas = {
  /**
   * Sent over a port: the background answers with a snapshot, and sends a new
   * one on the same port after every change until the port disconnects.
   */
  "graph.subscribe": v.object({}),
  /** Select the tab that shows one of the active session's open nodes. */
  "tab.focus": v.object({ tabId: v.number() }),
  /** Select the map's tab, opening one if none is open. */
  "map.open": v.object({}),
} as const;

export const researchMapResponseSchemas = {
  "graph.snapshot": graphSnapshotSchema,
  "tab.focused": v.object({ tabId: v.number() }),
  /** The tab holds no open node of the active session, or no session is active. */
  "tab.focusRefused": v.object({ tabId: v.number(), reason: v.string() }),
  "map.opened": v.object({}),
} as const;

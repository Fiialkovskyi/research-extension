import * as v from "valibot";

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

/** The active session's graph at one moment, or no session and nothing to draw. */
export const graphSnapshotSchema = v.object({
  session: v.nullable(v.object({ id: v.string(), title: v.string() })),
  nodes: v.array(mapNodeSchema),
  edges: v.array(mapEdgeSchema),
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

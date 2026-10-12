import { getNodeEngagement, type SessionGraph } from "@/features/researchGraph";
import type { StoredSession } from "@/shared/storage";

import type { GraphSnapshot } from "../../types";

/**
 * Builds what the map is told about the active session's graph.
 *
 * Records are reduced to the fields the map draws, so signals and anything the
 * background later stores on a node stay out of the protocol; the engagement
 * state the signals add up to is derived here, with the session's focus. With
 * no active session there is nothing to draw, whatever graph was passed.
 */
export const buildGraphSnapshot = (
  session: StoredSession | undefined,
  graph: SessionGraph,
): GraphSnapshot => {
  if (session === undefined) {
    return { session: null, nodes: [], edges: [] };
  }

  return {
    session: { id: session.id, title: session.title },
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      url: node.url,
      domain: node.domain,
      kind: node.kind,
      ...(node.query === undefined ? {} : { query: node.query }),
      tabId: node.tabId,
      tabState: node.tabState,
      engagement: getNodeEngagement(node, { isFocused: session.focus?.nodeId === node.id }),
      parentNodeId: node.parentNodeId,
      openerNodeId: node.openerNodeId,
      transitionType: node.transitionType,
      createdAt: node.createdAt,
    })),
    edges: graph.edges.map(({ id, from, to, kind }) => ({ id, from, to, kind })),
  };
};

import { Graph, layout } from "@dagrejs/dagre";
import { type Edge, MarkerType, type Node, Position } from "@xyflow/react";

import {
  MAP_NODE_HEIGHT,
  MAP_NODE_SEPARATION,
  MAP_NODE_WIDTH,
  MAP_RANK_SEPARATION,
} from "../../constants";
import type { GraphSnapshot, MapNode } from "../../types";

/** What a drawn node needs to render itself. */
export interface MapNodeData extends Record<string, unknown> {
  /** A SERP's query; otherwise the page title, or its URL when the page reported none. */
  label: string;
  domain: string;
  kind: "serp" | "page";
  tabId: number;
  tabState: "open" | "closed";
  engagement: MapNode["engagement"];
}

/** The snapshot as React Flow draws it: positioned nodes and styled edges. */
export interface MapLayout {
  nodes: Node<MapNodeData, "page">[];
  edges: Edge[];
}

/** What a node is called on the map: a search by its query, a page by its title. */
const readNodeLabel = (node: MapNode): string => {
  if (node.kind === "serp" && node.query !== undefined) {
    return node.query;
  }

  return node.title.trim() === "" ? node.url : node.title;
};

/**
 * Lays the snapshot out top-down, so a page sits below the page it was reached
 * from — by a link in the same tab or by opening a new one.
 *
 * Laid out from scratch on every call: the graph is small, and a layout that
 * remembered the last one would need to know which snapshot came before.
 */
export const buildMapLayout = (snapshot: GraphSnapshot): MapLayout => {
  const graph = new Graph();

  graph.setGraph({ rankdir: "TB", nodesep: MAP_NODE_SEPARATION, ranksep: MAP_RANK_SEPARATION });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of snapshot.nodes) {
    graph.setNode(node.id, { width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT });
  }

  // An edge to a node the snapshot does not hold would make dagre invent one.
  const edges = snapshot.edges.filter((edge) => graph.hasNode(edge.from) && graph.hasNode(edge.to));

  // Co-attention joins pages read side by side: neither came first, so it is
  // drawn but ranks nothing.
  for (const edge of edges.filter(({ kind }) => kind !== "coAttention")) {
    graph.setEdge(edge.from, edge.to);
  }

  layout(graph);

  return {
    nodes: snapshot.nodes.map((node) => {
      const { x, y } = graph.node(node.id);

      return {
        id: node.id,
        type: "page",
        // dagre places a node by its centre, React Flow by its top-left corner.
        position: { x: x - MAP_NODE_WIDTH / 2, y: y - MAP_NODE_HEIGHT / 2 },
        width: MAP_NODE_WIDTH,
        height: MAP_NODE_HEIGHT,
        // Declared rather than measured. React Flow attaches an edge only to a
        // node whose size and handles it knows, and forgets both when a node
        // object is replaced, as every snapshot replaces them. A box whose size
        // never changes is not measured again, so a later snapshot's edges
        // would never be drawn. The box is fixed, so both are known up front.
        measured: { width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT },
        handles: [
          { type: "target", position: Position.Top, x: MAP_NODE_WIDTH / 2, y: 0 },
          { type: "source", position: Position.Bottom, x: MAP_NODE_WIDTH / 2, y: MAP_NODE_HEIGHT },
        ],
        data: {
          label: readNodeLabel(node),
          domain: node.domain,
          kind: node.kind,
          tabId: node.tabId,
          tabState: node.tabState,
          engagement: node.engagement,
        },
      };
    }),
    edges: edges.map((edge) => {
      const drawn: Edge = {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        className: `edge-${edge.kind}`,
      };

      // Dashed for an opener, dotted for a refinement and dash-dotted for
      // co-attention, so the kinds differ in shape and not only in colour; a
      // same-tab edge stays solid. Co-attention has no direction, so no arrow.
      if (edge.kind === "opener") {
        drawn.style = { strokeDasharray: "6 4" };
      } else if (edge.kind === "refinement") {
        drawn.style = { strokeDasharray: "2 4" };
      } else if (edge.kind === "coAttention") {
        drawn.style = { strokeDasharray: "1 3 6 3" };
      }

      if (edge.kind !== "coAttention") {
        drawn.markerEnd = { type: MarkerType.ArrowClosed };
      }

      return drawn;
    }),
  };
};

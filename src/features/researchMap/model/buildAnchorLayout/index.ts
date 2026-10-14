import { Graph, layout } from "@dagrejs/dagre";
import { type Edge, MarkerType, type Node, Position } from "@xyflow/react";

import {
  MAP_NODE_HEIGHT,
  MAP_NODE_SEPARATION,
  MAP_NODE_WIDTH,
  MAP_RANK_SEPARATION,
} from "../../constants";
import type { GraphSnapshot, MapNode } from "../../types";
import { buildAnchorLinks } from "../buildAnchorLinks";
import { selectAnchors } from "../selectAnchors";
import { type HandleSide, type Point, pickHandleSides } from "./utils/pickHandleSides";

/** What a page is in the anchor view. */
export type AnchorRole = "anchor" | "root" | "page";

/** What a drawn box needs to render itself. */
export interface AnchorNodeData extends Record<string, unknown> {
  label: string;
  domain: string;
  role: AnchorRole;
  tabId: number;
  tabState: "open" | "closed";
  /** Times the page was focused. */
  visits: number;
  activeDwellMs: number;
  copyEvents: number;
  pasteEvents: number;
  /** Written into more than taken from: where the research is being collected. */
  isCollector: boolean;
  width: number;
  height: number;
}

/** The anchor view as React Flow draws it. */
export interface AnchorLayout {
  nodes: Node<AnchorNodeData, "anchor">[];
  edges: Edge[];
  /** How many pages are anchors; `0` means the view has nothing of its own to show. */
  anchorCount: number;
}

/** The boxes of anchors grow with reading time, from these… */
const ANCHOR_MINIMUM = { width: 150, height: 64 };
/** …by up to this much, for the session's longest-read page. */
const ANCHOR_GROWTH = { width: 90, height: 28 };
/** A page that is not an anchor, drawn only with its paths. */
const PAGE_BOX = { width: MAP_NODE_WIDTH * 0.6, height: MAP_NODE_HEIGHT * 0.6 };
/** Room per anchor on the ring, so its boxes do not overlap. */
const RING_SPACING = 120;
/** The edges the tree is built from: how one page led to another. */
const PATH_EDGE_KINDS = new Set(["opener", "sameTab", "refinement"]);

/** Where each side's handles sit on a box, and React Flow's name for the side. */
const SIDES: readonly {
  side: HandleSide;
  position: Position;
  readPoint: (width: number, height: number) => Point;
}[] = [
  { side: "top", position: Position.Top, readPoint: (width) => ({ x: width / 2, y: 0 }) },
  {
    side: "right",
    position: Position.Right,
    readPoint: (width, height) => ({ x: width, y: height / 2 }),
  },
  {
    side: "bottom",
    position: Position.Bottom,
    readPoint: (width, height) => ({ x: width / 2, y: height }),
  },
  {
    side: "left",
    position: Position.Left,
    readPoint: (_width, height) => ({ x: 0, y: height / 2 }),
  },
];

/** The handles an edge between two centres leaves and enters by. */
const pickEdgeHandles = (from: Point, to: Point) => {
  const { source, target } = pickHandleSides(from, to);

  return { sourceHandle: `${source}-source`, targetHandle: `${target}-target` };
};

/** What a box is called: a search by its query, a page by its title. */
const readLabel = (node: MapNode): string => {
  if (node.kind === "serp" && node.query !== undefined) {
    return node.query;
  }

  return node.title.trim() === "" ? node.url : node.title;
};

/** Places boxes evenly round a ring, the first one up and to the right. */
const placeOnRing = (ids: readonly string[]): Map<string, Point> => {
  const radius = Math.max(200, (ids.length * RING_SPACING) / Math.PI);

  return new Map(
    ids.map((id, index) => {
      const angle = -Math.PI / 2 + Math.PI / ids.length + (2 * Math.PI * index) / ids.length;

      return [id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }];
    }),
  );
};

/**
 * Lays out the anchor view: the pages the session kept returning to (see
 * `selectAnchors`) on a ring, joined by how often the user moved between them,
 * with the page the session began from above them.
 *
 * With `showPaths`, every other page is drawn too, small, in the tree of how
 * it was reached — so the detours that led to an anchor are visible — and the
 * moves between anchors are drawn over that tree without shaping it.
 */
export const buildAnchorLayout = (snapshot: GraphSnapshot, showPaths: boolean): AnchorLayout => {
  const anchorIds = selectAnchors(snapshot.nodes);
  const root = snapshot.nodes.toSorted((first, second) => first.createdAt - second.createdAt)[0];
  const maximumDwell = Math.max(1, ...snapshot.nodes.map(({ activeDwellMs }) => activeDwellMs));
  const readRole = (node: MapNode): AnchorRole => {
    if (anchorIds.has(node.id)) {
      return "anchor";
    }

    return node.id === root?.id ? "root" : "page";
  };
  const readSize = (node: MapNode): { width: number; height: number } => {
    if (readRole(node) === "page") {
      return PAGE_BOX;
    }

    const share = Math.sqrt(node.activeDwellMs / maximumDwell);

    return {
      width: Math.round(ANCHOR_MINIMUM.width + ANCHOR_GROWTH.width * share),
      height: Math.round(ANCHOR_MINIMUM.height + ANCHOR_GROWTH.height * share),
    };
  };
  const drawn = snapshot.nodes.filter((node) => showPaths || readRole(node) !== "page");
  const drawnIds = new Set(drawn.map(({ id }) => id));
  const centres = new Map<string, Point>();

  if (showPaths) {
    const graph = new Graph();

    graph.setGraph({ rankdir: "TB", nodesep: MAP_NODE_SEPARATION, ranksep: MAP_RANK_SEPARATION });
    graph.setDefaultEdgeLabel(() => ({}));

    for (const node of drawn) {
      graph.setNode(node.id, readSize(node));
    }

    for (const edge of snapshot.edges) {
      if (PATH_EDGE_KINDS.has(edge.kind) && drawnIds.has(edge.from) && drawnIds.has(edge.to)) {
        graph.setEdge(edge.from, edge.to);
      }
    }

    layout(graph);

    for (const node of drawn) {
      const { x, y } = graph.node(node.id);

      centres.set(node.id, { x, y });
    }
  } else {
    const ring = placeOnRing(drawn.filter(({ id }) => anchorIds.has(id)).map(({ id }) => id));

    for (const [id, centre] of ring) {
      centres.set(id, centre);
    }

    if (root !== undefined && !anchorIds.has(root.id)) {
      const top = Math.min(0, ...[...ring.values()].map(({ y }) => y));

      centres.set(root.id, { x: 0, y: top - 200 });
    }
  }

  const readCentre = (id: string): Point => centres.get(id) ?? { x: 0, y: 0 };
  const links = buildAnchorLinks(anchorIds, snapshot.activity, snapshot.edges);
  const pathEdges: Edge[] = showPaths
    ? snapshot.edges
        .filter(
          ({ kind, from, to }) =>
            PATH_EDGE_KINDS.has(kind) && drawnIds.has(from) && drawnIds.has(to),
        )
        .map((edge) => ({
          id: edge.id,
          source: edge.from,
          target: edge.to,
          ...pickEdgeHandles(readCentre(edge.from), readCentre(edge.to)),
          className: "edge-path",
          markerEnd: { type: MarkerType.ArrowClosed },
        }))
    : [];
  const linkEdges: Edge[] = links.map((link) => ({
    id: `${link.from}|${link.to}|anchor`,
    source: link.from,
    target: link.to,
    ...pickEdgeHandles(readCentre(link.from), readCentre(link.to)),
    className: "edge-anchor",
    // Thicker for a pair the user moved between more; arrows show which ways.
    style: { strokeWidth: Math.min(5, 1 + (link.forward + link.backward) / 2) },
    markerEnd: { type: MarkerType.ArrowClosed },
    ...(link.backward > 0 ? { markerStart: { type: MarkerType.ArrowClosed } } : {}),
  }));

  return {
    nodes: drawn.map((node) => {
      const { width, height } = readSize(node);
      const { x, y } = readCentre(node.id);

      return {
        id: node.id,
        type: "anchor",
        position: { x: x - width / 2, y: y - height / 2 },
        width,
        height,
        // Declared, not measured, for the reason `buildMapLayout` gives.
        measured: { width, height },
        handles: SIDES.flatMap(({ side, position, readPoint }) => [
          { id: `${side}-source`, type: "source" as const, position, ...readPoint(width, height) },
          { id: `${side}-target`, type: "target" as const, position, ...readPoint(width, height) },
        ]),
        data: {
          label: readLabel(node),
          domain: node.domain,
          role: readRole(node),
          tabId: node.tabId,
          tabState: node.tabState,
          visits: node.focusCount,
          activeDwellMs: node.activeDwellMs,
          copyEvents: node.copyEvents,
          pasteEvents: node.pasteEvents,
          isCollector: node.pasteEvents > node.copyEvents,
          width,
          height,
        },
      };
    }),
    edges: [...pathEdges, ...linkEdges],
    anchorCount: anchorIds.size,
  };
};

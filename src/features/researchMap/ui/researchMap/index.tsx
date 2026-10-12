import { type Node, type NodeMouseHandler, type NodeTypes, ReactFlow } from "@xyflow/react";
import { useCallback, useMemo } from "react";

import { buildMapLayout, type MapNodeData } from "../../model/buildMapLayout";
import type { GraphSnapshot } from "../../types";
import { MapPageNode } from "../mapPageNode";

export interface ResearchMapProps {
  snapshot: GraphSnapshot;
  /** Called with the tab of an open page the user activated. */
  onFocusTab: (tabId: number) => void;
}

/** Declared once: React Flow re-registers every node type when this object changes. */
const NODE_TYPES: NodeTypes = { page: MapPageNode };

/**
 * The session's graph, laid out top-down.
 *
 * Read-only: nodes are not dragged, connected or selected. A click on a node —
 * or Enter on an open node's button, which the browser turns into a click —
 * reaches `onNodeClick`; only an open page passes it on. The view fits the
 * graph when it first appears and is left where the user put it afterwards.
 */
export function ResearchMap({ snapshot, onFocusTab }: ResearchMapProps) {
  const { nodes, edges } = useMemo(() => buildMapLayout(snapshot), [snapshot]);

  const handleNodeClick: NodeMouseHandler<Node<MapNodeData, "page">> = useCallback(
    (_event, node) => {
      if (node.data.tabState === "open") {
        onFocusTab(node.data.tabId);
      }
    },
    [onFocusTab],
  );

  return (
    <div data-testid="research-map" className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        colorMode="system"
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        minZoom={0.1}
      />
    </div>
  );
}

import { type Node, type NodeMouseHandler, type NodeTypes, ReactFlow } from "@xyflow/react";
import { useCallback, useId, useMemo, useState } from "react";

import { type AnchorNodeData, buildAnchorLayout } from "../../model/buildAnchorLayout";
import type { GraphSnapshot } from "../../types";
import { AnchorNode } from "../anchorNode";

export interface AnchorViewProps {
  snapshot: GraphSnapshot;
  /** Called with the tab of an open page the user activated. */
  onFocusTab: (tabId: number) => void;
}

/** Declared once: React Flow re-registers every node type when this object changes. */
const NODE_TYPES: NodeTypes = { anchor: AnchorNode };

/**
 * The anchor view: the pages the session kept returning to, joined by how the
 * user moved between them, with a switch that adds the paths that led there.
 */
export function AnchorView({ snapshot, onFocusTab }: AnchorViewProps) {
  const [showPaths, setShowPaths] = useState(false);
  const toggleId = useId();
  const { nodes, edges, anchorCount } = useMemo(
    () => buildAnchorLayout(snapshot, showPaths),
    [snapshot, showPaths],
  );

  const handleNodeClick: NodeMouseHandler<Node<AnchorNodeData, "anchor">> = useCallback(
    (_event, node) => {
      if (node.data.tabState === "open") {
        onFocusTab(node.data.tabId);
      }
    },
    [onFocusTab],
  );

  return (
    <div data-testid="map-anchors" className="relative h-full w-full">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-3 rounded-md bg-white/90 px-3 py-1.5 text-xs shadow-sm dark:bg-neutral-900/90">
        <label htmlFor={toggleId} className="flex items-center gap-1.5">
          <input
            id={toggleId}
            type="checkbox"
            data-testid="anchor-show-paths"
            checked={showPaths}
            onChange={(event) => {
              setShowPaths(event.target.checked);
            }}
          />
          Show paths
        </label>
        <span className="text-neutral-500">
          {anchorCount === 1 ? "1 anchor" : `${anchorCount} anchors`}
        </span>
      </div>
      {anchorCount === 0 && !showPaths && (
        <p
          data-testid="map-anchors-empty"
          className="absolute top-14 left-3 z-10 max-w-sm text-sm text-neutral-600 dark:text-neutral-400"
        >
          No anchors yet: pages become anchors after returns, copies or long reads.
        </p>
      )}
      <ReactFlow
        key={showPaths ? "paths" : "anchors"}
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

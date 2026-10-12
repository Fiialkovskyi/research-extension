import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";

import type { MapNodeData } from "../../model/buildMapLayout";

export type MapPageNodeProps = NodeProps<Node<MapNodeData, "page">>;

const BOX_CLASS =
  "flex h-full w-full flex-col justify-center gap-0.5 overflow-hidden rounded-md border px-3 py-1 text-left text-xs";

/**
 * One page on the map: its title and domain.
 *
 * An open page is a button, so it can be reached and activated from the
 * keyboard; activating it is handled by the map, which hears the click. A
 * closed page is not interactive, and says `closed` in words as well as by its
 * dimmed, dashed box.
 */
export function MapPageNode({ id, data }: MapPageNodeProps) {
  const content = (
    <>
      <span className="truncate font-medium">{data.label}</span>
      <span className="truncate text-neutral-500 dark:text-neutral-400">
        {data.domain}
        {data.tabState === "closed" && " · closed"}
      </span>
    </>
  );

  return (
    <>
      {/* Edges attach to handles; nothing is connected by hand on this map. */}
      <Handle type="target" position={Position.Top} isConnectable={false} className="opacity-0" />
      {data.tabState === "open" ? (
        <button
          type="button"
          data-testid="map-node"
          data-node-id={id}
          data-tab-state="open"
          title={data.label}
          className={`${BOX_CLASS} cursor-pointer border-neutral-400 bg-white text-neutral-900 hover:border-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-neutral-500 dark:bg-neutral-800 dark:text-neutral-100`}
        >
          {content}
        </button>
      ) : (
        <div
          data-testid="map-node"
          data-node-id={id}
          data-tab-state="closed"
          title={data.label}
          className={`${BOX_CLASS} border-dashed border-neutral-300 bg-neutral-100 text-neutral-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-400`}
        >
          {content}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="opacity-0"
      />
    </>
  );
}

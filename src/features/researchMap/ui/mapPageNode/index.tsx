import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";

import type { MapNodeData } from "../../model/buildMapLayout";

export type MapPageNodeProps = NodeProps<Node<MapNodeData, "page">>;

/**
 * How each engagement state is shown: in words, and by a marker whose shape —
 * not only its colour — differs between states (REQ-UI-002).
 */
const ENGAGEMENT_DISPLAY: Record<MapNodeData["engagement"], { words: string; marker: string }> = {
  unread: { words: "unread", marker: "○" },
  skimmed: { words: "skimmed", marker: "◐" },
  deep_read: { words: "deep read", marker: "●" },
  dead_end: { words: "dead end", marker: "✕" },
};

const BOX_CLASS =
  "flex h-full w-full flex-col justify-center gap-0.5 overflow-hidden rounded-md border px-3 py-1 text-left text-xs";

/**
 * One page on the map: its title and domain. A search shows its query instead
 * of a title and says `search` in words, so its kind is not carried by colour.
 *
 * Each page shows how engaged the user was with it, in words and by a marker
 * whose shape differs between states.
 *
 * An open page is a button, so it can be reached and activated from the
 * keyboard; activating it is handled by the map, which hears the click. A
 * closed page is not interactive, and says `closed` in words as well as by its
 * dimmed, dashed box.
 */
export function MapPageNode({ id, data }: MapPageNodeProps) {
  const engagement = ENGAGEMENT_DISPLAY[data.engagement];
  const content = (
    <>
      <span className="flex items-center gap-1 font-medium">
        <span data-testid="engagement-marker" aria-hidden="true" className="shrink-0">
          {engagement.marker}
        </span>
        <span className="truncate">{data.label}</span>
      </span>
      <span className="truncate text-neutral-500 dark:text-neutral-400">
        {data.kind === "serp" && "search · "}
        {data.domain}
        {data.tabState === "closed" && " · closed"}
        {` · ${engagement.words}`}
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
          data-node-kind={data.kind}
          data-engagement={data.engagement}
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
          data-node-kind={data.kind}
          data-engagement={data.engagement}
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

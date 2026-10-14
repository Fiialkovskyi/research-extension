import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";

import type { AnchorNodeData } from "../../model/buildAnchorLayout";
import { formatDuration } from "../../model/formatDuration";

export type AnchorNodeProps = NodeProps<Node<AnchorNodeData, "anchor">>;

/** Each side of the box, with a handle for edges leaving and one for edges arriving. */
const SIDES = [
  { side: "top", position: Position.Top },
  { side: "right", position: Position.Right },
  { side: "bottom", position: Position.Bottom },
  { side: "left", position: Position.Left },
] as const;

/** The outline each kind of box wears. The kind is also in words, never colour alone. */
const ROLE_CLASS = {
  anchor: "border-2 border-emerald-600 dark:border-emerald-500",
  collector: "border-2 border-blue-600 dark:border-blue-500",
  root: "border-2 border-amber-600 dark:border-amber-400",
  page: "border border-neutral-300 dark:border-neutral-600",
} as const;

/**
 * One page in the anchor view. An anchor shows how often it was visited, for
 * how long and how much was copied from or pasted into it; a page written into
 * more than taken from is outlined as where the research is being collected.
 * An open page is a button that selects its tab.
 */
export function AnchorNode({ id, data }: AnchorNodeProps) {
  const kind = data.role === "anchor" && data.isCollector ? "collector" : data.role;
  const isSmall = data.role === "page";
  const marks = [
    data.copyEvents > 0 ? `${data.copyEvents} ${data.copyEvents === 1 ? "copy" : "copies"}` : "",
    data.pasteEvents > 0
      ? `${data.pasteEvents} ${data.pasteEvents === 1 ? "paste" : "pastes"}`
      : "",
  ].filter((part) => part !== "");
  const className = `flex h-full w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg bg-white px-2 text-center text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 ${ROLE_CLASS[kind]} ${isSmall ? "text-[10px]" : "text-xs"}`;
  const content = (
    <>
      <span className={`line-clamp-2 font-medium ${isSmall ? "" : "text-sm"}`}>{data.label}</span>
      {!isSmall && (
        <span className="text-neutral-600 dark:text-neutral-400">
          {data.role === "root" ? "start · " : ""}
          {kind === "collector" ? "collecting · " : ""}
          {`${data.visits} ${data.visits === 1 ? "visit" : "visits"} · ${formatDuration(data.activeDwellMs)}`}
        </span>
      )}
      {!isSmall && marks.length > 0 && (
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {marks.join(" · ")}
        </span>
      )}
    </>
  );

  return (
    <>
      {SIDES.map(({ side, position }) => (
        <Handle
          key={`${side}-target`}
          id={`${side}-target`}
          type="target"
          position={position}
          isConnectable={false}
          className="opacity-0"
        />
      ))}
      {data.tabState === "open" ? (
        <button
          type="button"
          data-testid="anchor-node"
          data-node-id={id}
          data-role={kind}
          title={data.label}
          className={`${className} cursor-pointer hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-600`}
        >
          {content}
        </button>
      ) : (
        <div
          data-testid="anchor-node"
          data-node-id={id}
          data-role={kind}
          title={`${data.label} (closed)`}
          className={`${className} border-dashed opacity-70`}
        >
          {content}
        </div>
      )}
      {SIDES.map(({ side, position }) => (
        <Handle
          key={`${side}-source`}
          id={`${side}-source`}
          type="source"
          position={position}
          isConnectable={false}
          className="opacity-0"
        />
      ))}
    </>
  );
}

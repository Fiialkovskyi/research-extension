import { type KeyboardEvent, useEffect, useRef } from "react";

import { ENGAGEMENT_DISPLAY } from "@/shared/config";

import type { MapNode } from "@/features/researchMap";

import type { TreeRow } from "../../model/buildResearchTree";
import { listVisibleRows, type VisibleRow } from "../../model/listVisibleRows";
import { moveTreeFocus, type TreeFocus, type TreeKey } from "../../model/moveTreeFocus";

export interface ResearchTreeProps {
  forest: readonly TreeRow[];
  focus: TreeFocus;
  /** The user moved focus, or expanded or collapsed a row. */
  onFocusChange: (focus: TreeFocus) => void;
  /** The user activated an open page: select its tab. */
  onFocusTab: (tabId: number) => void;
}

const TREE_KEYS: readonly string[] = [
  "ArrowDown",
  "ArrowUp",
  "ArrowRight",
  "ArrowLeft",
  "Home",
  "End",
] satisfies TreeKey[];

const isTreeKey = (key: string): key is TreeKey => TREE_KEYS.includes(key);

/** What a page row says: a search by its query, a page by its title or URL. */
const readPageLabel = (node: MapNode): string => {
  if (node.kind === "serp" && node.query !== undefined) {
    return `search · ${node.query}`;
  }

  return node.title.trim() === "" ? node.url : node.title;
};

const ROW_CLASS =
  "flex cursor-default items-baseline gap-1 rounded py-0.5 pr-1 outline-none focus-visible:outline-2 focus-visible:outline-blue-600";

/**
 * The session's pages as a tree, following the WAI-ARIA tree pattern: one tab
 * stop, arrows to move, expand and collapse, Home and End, Enter to return to
 * an open page's tab.
 *
 * Each row says how engaged the user was in words and by a marker whose shape
 * differs between states, marks a page copied from, and says `closed` when its
 * tab is gone — none of it carried by colour alone.
 *
 * Once the session is clustered, clusters are top-level rows holding their
 * pages; a cluster row expands and collapses but selects no tab.
 *
 * Controlled: focus and collapsed rows belong to the surface, so they survive a
 * new snapshot of the graph.
 */
export function ResearchTree({ forest, focus, onFocusChange, onFocusTab }: ResearchTreeProps) {
  const rows = listVisibleRows(forest, focus.collapsed);
  const focusedId = rows.some(({ row }) => row.id === focus.focusedId)
    ? focus.focusedId
    : rows[0]?.row.id;
  const treeRef = useRef<HTMLUListElement>(null);

  // Keyboard focus follows the focused row, but only while the tree has it:
  // a new snapshot must not pull focus away from elsewhere in the popup.
  useEffect(() => {
    const tree = treeRef.current;

    if (tree?.contains(document.activeElement) === true) {
      tree.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(focusedId ?? "")}"]`)?.focus();
    }
  }, [focusedId]);

  const activate = ({ row }: VisibleRow) => {
    if (row.kind === "page" && row.node.tabState === "open") {
      onFocusTab(row.node.tabId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const current = rows.find(({ row }) => row.id === focusedId);

    if (event.key === "Enter" && current !== undefined) {
      event.preventDefault();
      activate(current);
      return;
    }

    if (isTreeKey(event.key)) {
      event.preventDefault();
      onFocusChange(moveTreeFocus(rows, { focusedId, collapsed: focus.collapsed }, event.key));
    }
  };

  return (
    <ul
      ref={treeRef}
      role="tree"
      aria-label="Research tree"
      data-testid="research-tree"
      className="flex flex-col text-sm"
      onKeyDown={handleKeyDown}
    >
      {rows.map((entry) => {
        const { row } = entry;
        const isFocused = row.id === focusedId;
        const treeItem = {
          role: "treeitem",
          "data-node-id": row.id,
          "data-row-kind": row.kind,
          "aria-level": entry.level,
          "aria-posinset": entry.positionInSet,
          "aria-setsize": entry.setSize,
          "aria-selected": isFocused,
          ...(entry.hasChildren ? { "aria-expanded": !focus.collapsed.has(row.id) } : {}),
          tabIndex: isFocused ? 0 : -1,
          style: { paddingLeft: `${(entry.level - 1) * 12 + 4}px` },
          onClick: () => {
            onFocusChange({ focusedId: row.id, collapsed: focus.collapsed });
            activate(entry);
          },
        } as const;
        const highlight = isFocused ? "bg-neutral-100 dark:bg-neutral-800" : "";

        if (row.kind === "cluster") {
          return (
            <li key={row.id} {...treeItem} className={`${ROW_CLASS} ${highlight} font-medium`}>
              <span className="truncate">{`${row.label} · ${row.size}`}</span>
            </li>
          );
        }

        const { node } = row;
        const engagement = ENGAGEMENT_DISPLAY[node.engagement];

        return (
          <li
            key={row.id}
            {...treeItem}
            data-engagement={node.engagement}
            data-tab-state={node.tabState}
            className={`${ROW_CLASS} ${highlight} ${
              node.tabState === "closed" ? "text-neutral-500 dark:text-neutral-400" : ""
            }`}
          >
            <span aria-hidden="true" className="shrink-0">
              {engagement.marker}
            </span>
            <span className="truncate">{readPageLabel(node)}</span>
            <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
              {engagement.words}
              {node.tabState === "closed" && " · closed"}
            </span>
            {node.copyEvents > 0 && (
              <span aria-label="copied from" role="img" className="shrink-0 text-xs">
                ✂
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

import { type KeyboardEvent, useEffect, useRef } from "react";

import { ENGAGEMENT_DISPLAY } from "@/shared/config";

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

/** What a row says: a search by its query, a page by its title or URL. */
const readLabel = ({ node }: VisibleRow): string => {
  if (node.kind === "serp" && node.query !== undefined) {
    return `search · ${node.query}`;
  }

  return node.title.trim() === "" ? node.url : node.title;
};

/**
 * The session's pages as a tree, following the WAI-ARIA tree pattern: one tab
 * stop, arrows to move, expand and collapse, Home and End, Enter to return to
 * an open page's tab.
 *
 * Each row says how engaged the user was in words and by a marker whose shape
 * differs between states, marks a page copied from, and says `closed` when its
 * tab is gone — none of it carried by colour alone.
 *
 * Controlled: focus and collapsed rows belong to the surface, so they survive a
 * new snapshot of the graph.
 */
export function ResearchTree({ forest, focus, onFocusChange, onFocusTab }: ResearchTreeProps) {
  const rows = listVisibleRows(forest, focus.collapsed);
  const focusedId = rows.some(({ node }) => node.id === focus.focusedId)
    ? focus.focusedId
    : rows[0]?.node.id;
  const treeRef = useRef<HTMLUListElement>(null);

  // Keyboard focus follows the focused row, but only while the tree has it:
  // a new snapshot must not pull focus away from elsewhere in the popup.
  useEffect(() => {
    const tree = treeRef.current;

    if (tree?.contains(document.activeElement) === true) {
      tree.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(focusedId ?? "")}"]`)?.focus();
    }
  }, [focusedId]);

  const activate = (row: VisibleRow) => {
    if (row.node.tabState === "open") {
      onFocusTab(row.node.tabId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const current = rows.find(({ node }) => node.id === focusedId);

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
      {rows.map((row) => {
        const { node } = row;
        const engagement = ENGAGEMENT_DISPLAY[node.engagement];
        const isFocused = node.id === focusedId;

        return (
          <li
            key={node.id}
            role="treeitem"
            data-node-id={node.id}
            data-engagement={node.engagement}
            data-tab-state={node.tabState}
            aria-level={row.level}
            aria-posinset={row.positionInSet}
            aria-setsize={row.setSize}
            aria-selected={isFocused}
            {...(row.hasChildren ? { "aria-expanded": !focus.collapsed.has(node.id) } : {})}
            tabIndex={isFocused ? 0 : -1}
            style={{ paddingLeft: `${(row.level - 1) * 12 + 4}px` }}
            className={`flex cursor-default items-baseline gap-1 rounded py-0.5 pr-1 outline-none focus-visible:outline-2 focus-visible:outline-blue-600 ${
              isFocused ? "bg-neutral-100 dark:bg-neutral-800" : ""
            } ${node.tabState === "closed" ? "text-neutral-500 dark:text-neutral-400" : ""}`}
            onClick={() => {
              onFocusChange({ focusedId: node.id, collapsed: focus.collapsed });
              activate(row);
            }}
          >
            <span aria-hidden="true" className="shrink-0">
              {engagement.marker}
            </span>
            <span className="truncate">{readLabel(row)}</span>
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

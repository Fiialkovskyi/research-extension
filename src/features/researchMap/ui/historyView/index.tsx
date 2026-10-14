import { useMemo } from "react";

import { buildHistoryEntries } from "../../model/buildHistoryEntries";
import { formatDuration } from "../../model/formatDuration";
import type { GraphSnapshot } from "../../types";

export interface HistoryViewProps {
  snapshot: GraphSnapshot;
  /** Called with the tab of an open page the user activated. */
  onFocusTab: (tabId: number) => void;
}

/**
 * The session as a plain history: every stretch of reading in order, with when
 * it began and how long it lasted, a bar showing that length against the
 * session's longest. An open page's row is a button that selects its tab.
 */
export function HistoryView({ snapshot, onFocusTab }: HistoryViewProps) {
  const entries = useMemo(() => buildHistoryEntries(snapshot), [snapshot]);
  const nodes = useMemo(
    () => new Map(snapshot.nodes.map((node) => [node.id, node])),
    [snapshot.nodes],
  );
  const longest = Math.max(
    1,
    ...entries.map(({ startedAt, endedAt }) => (endedAt === null ? 0 : endedAt - startedAt)),
  );
  const isTimed = entries.some(({ endedAt }) => endedAt !== null);

  return (
    <div data-testid="map-history" className="h-full overflow-y-auto p-4">
      {!isTimed && entries.length > 0 && (
        <p data-testid="map-history-untimed" className="mb-3 text-xs text-neutral-500">
          Reading time was not logged for this session yet; pages are listed in the order they were
          opened.
        </p>
      )}
      {entries.length === 0 && <p className="text-sm">Nothing was read yet.</p>}
      <ol className="flex max-w-3xl flex-col gap-1">
        {entries.map((entry) => {
          const node = nodes.get(entry.nodeId);

          if (node === undefined) {
            return null;
          }

          const label =
            node.kind === "serp" && node.query !== undefined
              ? node.query
              : node.title.trim() === ""
                ? node.url
                : node.title;
          const durationMs = entry.endedAt === null ? null : entry.endedAt - entry.startedAt;
          const content = (
            <>
              <time
                dateTime={new Date(entry.startedAt).toISOString()}
                className="w-12 shrink-0 font-mono text-neutral-500 tabular-nums"
              >
                {new Date(entry.startedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{label}</span>
                <span className="truncate text-neutral-500 dark:text-neutral-400">
                  {node.kind === "serp" && "search · "}
                  {node.domain}
                  {node.tabState === "closed" && " · closed"}
                </span>
              </span>
              {durationMs !== null && (
                <span className="flex w-40 shrink-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-1.5 rounded-full bg-blue-600 dark:bg-blue-500"
                    style={{ width: `${Math.max(2, (durationMs / longest) * 100)}%` }}
                  />
                  <span className="text-neutral-600 tabular-nums dark:text-neutral-400">
                    {formatDuration(durationMs)}
                  </span>
                </span>
              )}
            </>
          );
          const rowClass = "flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-xs";

          return (
            <li
              key={`${entry.nodeId}-${entry.startedAt}`}
              data-testid="map-history-entry"
              data-node-id={entry.nodeId}
            >
              {node.tabState === "open" ? (
                <button
                  type="button"
                  onClick={() => {
                    onFocusTab(node.tabId);
                  }}
                  className={`${rowClass} hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-neutral-900`}
                >
                  {content}
                </button>
              ) : (
                <div className={`${rowClass} text-neutral-500`}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

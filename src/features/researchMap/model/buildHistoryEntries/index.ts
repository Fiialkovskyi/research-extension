import type { GraphSnapshot } from "../../types";

/** One stretch of reading a page, as the history lists it. */
export interface HistoryEntry {
  nodeId: string;
  startedAt: number;
  /** `null` when only the page's opening is known, not how long it was read. */
  endedAt: number | null;
}

/**
 * Lists the session as it was read: each stretch on a page in time order, with
 * back-to-back intervals on one page joined into one entry, so a page returned
 * to later appears again where the user came back to it.
 *
 * A session recorded before reading was logged has no intervals; its pages are
 * then listed in the order they were opened, without durations.
 */
export const buildHistoryEntries = (snapshot: GraphSnapshot): HistoryEntry[] => {
  const known = new Set(snapshot.nodes.map(({ id }) => id));
  const intervals = snapshot.activity
    .filter(({ kind, nodeId }) => kind === "focus" && known.has(nodeId))
    .toSorted((first, second) => first.at - second.at);

  if (intervals.length === 0) {
    return snapshot.nodes
      .toSorted((first, second) => first.createdAt - second.createdAt)
      .map(({ id, createdAt }) => ({ nodeId: id, startedAt: createdAt, endedAt: null }));
  }

  const entries: HistoryEntry[] = [];

  for (const { nodeId, at, endAt } of intervals) {
    const last = entries.at(-1);

    if (last?.nodeId === nodeId) {
      last.endedAt = Math.max(last.endedAt ?? endAt, endAt);
    } else {
      entries.push({ nodeId, startedAt: at, endedAt: endAt });
    }
  }

  return entries;
};

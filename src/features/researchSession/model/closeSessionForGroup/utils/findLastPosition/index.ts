import type { StoredLastPosition, StoredNode, StoredSession } from "@/shared/storage";

/** The page the user was on: the one in focus, or else the one focused last. */
export const findLastPosition = (
  session: StoredSession,
  nodes: readonly StoredNode[],
): StoredLastPosition | undefined => {
  const node =
    nodes.find(({ id }) => id === session.focus?.nodeId) ??
    nodes
      .filter(({ lastFocusedAt }) => lastFocusedAt !== undefined)
      .toSorted((first, second) => (second.lastFocusedAt ?? 0) - (first.lastFocusedAt ?? 0))[0];

  return node === undefined
    ? undefined
    : { nodeId: node.id, title: node.title, readFraction: node.signals.maxScroll };
};

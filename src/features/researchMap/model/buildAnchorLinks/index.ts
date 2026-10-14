import type { MapActivity, MapEdge } from "../../types";

/** How often the user moved between two anchors, each way. */
export interface AnchorLink {
  /** The anchor the first move between the two started from. */
  from: string;
  to: string;
  /** Moves from `from` to `to`. */
  forward: number;
  /** Moves from `to` back to `from`. */
  backward: number;
}

/**
 * Finds how the user moved between anchors: reading the session's intervals
 * in order, every change from one anchor to another is a move, however many
 * other pages were read in between — a detour through a forum on the way back
 * to a product page still joins the two.
 *
 * A session recorded before reading was logged has no intervals; its
 * co-attention edges between anchors are taken instead, as moves both ways.
 */
export const buildAnchorLinks = (
  anchorIds: ReadonlySet<string>,
  activity: readonly MapActivity[],
  edges: readonly MapEdge[],
): AnchorLink[] => {
  const sequence = activity
    .filter(({ kind, nodeId }) => kind === "focus" && anchorIds.has(nodeId))
    .toSorted((first, second) => first.at - second.at)
    .map(({ nodeId }) => nodeId);

  if (sequence.length === 0) {
    return edges
      .filter(
        ({ kind, from, to }) => kind === "coAttention" && anchorIds.has(from) && anchorIds.has(to),
      )
      .map(({ from, to }) => ({ from, to, forward: 1, backward: 1 }));
  }

  const links = new Map<string, AnchorLink>();

  sequence.forEach((to, index) => {
    const from = index === 0 ? undefined : sequence[index - 1];

    if (from === undefined || from === to) {
      return;
    }

    const key = [from, to].toSorted().join("|");
    const link = links.get(key);

    if (link === undefined) {
      links.set(key, { from, to, forward: 1, backward: 0 });
    } else if (link.from === from) {
      link.forward += 1;
    } else {
      link.backward += 1;
    }
  });

  return [...links.values()];
};

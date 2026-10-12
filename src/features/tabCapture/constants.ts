import type { EdgeKind } from "@/shared/storage";

/**
 * Default weight of each edge kind capture records, from the target spec's
 * `cluster_config@1`. Clustering reads the weight from the edge, so a change
 * here affects only edges recorded afterwards.
 */
export const CAPTURE_EDGE_WEIGHTS = {
  opener: 1,
  sameTab: 0.5,
  // Low on purpose: a sub-query should seed a cluster of its own rather than
  // merge with the root's.
  refinement: 0.3,
} as const satisfies Partial<Record<EdgeKind, number>>;

/** Transition type of a node recorded because its tab joined the group. */
export const JOINED_TRANSITION = "joined";

/** Transition type of a node recorded for a tab restored after a restart. */
export const RESTORED_TRANSITION = "restored";

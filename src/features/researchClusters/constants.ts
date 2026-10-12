/** The clustering algorithm and its version, recorded on every result (REQ-CLU-006). */
export const CLUSTER_ALGORITHM_VERSION = "louvain@1";

/**
 * The edge weights and options clustering used. The weights themselves are on
 * each edge, set by capture from the target spec's `cluster_config@1`.
 */
export const CLUSTER_CONFIG_VERSION = "cluster_config@1";

/** Seeds Louvain's random choices, so the same graph always gives the same clusters. */
export const CLUSTER_SEED = 0x5eed_c105;

/** How long the graph must be quiet before the session is clustered again (REQ-CLU-003). */
export const RECLUSTER_DELAY_MS = 5_000;

/** Semantic edges join pages at least this similar (`cluster_config@1`'s τ). */
export const SEMANTIC_THRESHOLD = 0.55;

/** A semantic edge weighs this × (similarity − τ) / (1 − τ): at most this, at similarity 1. */
export const SEMANTIC_WEIGHT_SCALE = 1.2;

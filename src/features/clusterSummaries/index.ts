/**
 * Cluster summaries (REQ-SYN-003/004, REQ-LIN-006/007): a few statements per
 * cluster, written by the local generation model from the cluster's grounded
 * facts only, each citing the facts it rests on, regenerated on the
 * generation schedule once a cluster's facts settle, and marked stale when
 * they no longer match what was read. Statement text is stored encrypted.
 */

// `ui/` is deliberately absent from this barrel: the background imports
// feature barrels and has no use for React. Surfaces import components by path.

export {
  CLUSTER_SUMMARY_PROMPT,
  MAXIMUM_SUMMARY_FACTS,
  SUMMARIES_PAGE_PATH,
  SUMMARIZE_CLUSTER_JOB,
} from "./constants";
export {
  clusterSummaryRequestSchemas,
  clusterSummaryResponseSchemas,
  summarizeClusterPayloadSchema,
} from "./schemas";
export type { ClusterSummaryView, SummaryCitation, SummaryFact, SummaryStatement } from "./types";
export { enqueueClusterSummaries } from "./model/enqueueClusterSummaries";
export { readSummariesView, type SummariesView } from "./model/readSummariesView";
export { requestClusterSummary } from "./model/requestClusterSummary";
export {
  runClusterSummaryJob,
  type RunClusterSummaryJobOptions,
} from "./model/runClusterSummaryJob";

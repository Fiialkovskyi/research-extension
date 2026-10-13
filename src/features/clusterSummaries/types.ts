import type * as v from "valibot";

import type {
  clusterSummaryAnswerSchema,
  clusterSummaryViewSchema,
  summarizeClusterPayloadSchema,
  summaryCitationSchema,
  summaryStatementSchema,
} from "./schemas";

export type ClusterSummaryAnswer = v.InferOutput<typeof clusterSummaryAnswerSchema>;
export type SummaryStatement = v.InferOutput<typeof summaryStatementSchema>;
export type SummarizeClusterPayload = v.InferOutput<typeof summarizeClusterPayloadSchema>;
export type SummaryCitation = v.InferOutput<typeof summaryCitationSchema>;
export type ClusterSummaryView = v.InferOutput<typeof clusterSummaryViewSchema>;

/** A fact as a summary is built from it: decrypted, with the group it is spread across. */
export interface SummaryFact {
  id: string;
  nodeId: string;
  /** Its root entity, or its subject when it has none: facts are chosen across these. */
  groupKey: string;
  subject: string;
  attribute: string;
  value: string;
  unit?: string;
  quote: string;
}

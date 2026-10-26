import type * as v from "valibot";

import type {
  cardValueSchema,
  clusterSummaryAnswerSchema,
  clusterSummaryViewSchema,
  productCardSchema,
  summarizeClusterPayloadSchema,
  summaryCitationSchema,
  summaryStatementSchema,
} from "./schemas";

export type ClusterSummaryAnswer = v.InferOutput<typeof clusterSummaryAnswerSchema>;
export type SummaryStatement = v.InferOutput<typeof summaryStatementSchema>;
export type SummarizeClusterPayload = v.InferOutput<typeof summarizeClusterPayloadSchema>;
export type SummaryCitation = v.InferOutput<typeof summaryCitationSchema>;
export type CardValue = v.InferOutput<typeof cardValueSchema>;
export type ProductCard = v.InferOutput<typeof productCardSchema>;
export type ClusterSummaryView = v.InferOutput<typeof clusterSummaryViewSchema>;

/** A fact as a summary is built from it: decrypted, with the group it is spread across. */
export interface SummaryFact {
  id: string;
  nodeId: string;
  /** Its root entity, or its subject when it has none: facts are chosen across these. */
  groupKey: string;
  /** What the fact is about: its root entity's name, else its subject. */
  entityName: string;
  /** Its root entity's type, or `unknown` when it has none or it cannot be read. */
  entityType: string;
  subject: string;
  attribute: string;
  /** The attribute's column key, so spellings in several languages are one. */
  attributeKey: string;
  value: string;
  unit?: string;
  quote: string;
  /** Made from the page's own product data, not read by the model. */
  isPageData: boolean;
}

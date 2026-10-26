import * as v from "valibot";

import { MAXIMUM_SUMMARY_STATEMENTS } from "./constants";

/**
 * A `clusterSummary@1` answer, as it must be before anything is stored.
 * Mirrors `prompts/clusterSummary@1.schema.json`; `constants.spec.ts` keeps
 * the two in step.
 */
export const clusterSummaryAnswerSchema = v.object({
  statements: v.pipe(
    v.array(v.object({ text: v.string(), facts: v.array(v.string()) })),
    v.maxLength(MAXIMUM_SUMMARY_STATEMENTS),
  ),
});

/** A stored statement, as encrypted into the store: its text and the facts it cites. */
export const summaryStatementSchema = v.object({
  text: v.string(),
  factIds: v.array(v.string()),
});

/** What a summary job works on. */
export const summarizeClusterPayloadSchema = v.object({
  clusterId: v.string(),
  factSetHash: v.string(),
  /** Set when the user asked; such a job runs while the user is active. */
  requestedAt: v.optional(v.number()),
});

/** A citation as the Summaries page shows it. */
export const summaryCitationSchema = v.object({
  factId: v.string(),
  pageTitle: v.string(),
  url: v.string(),
  quote: v.string(),
  /** The page's site, when it said. */
  siteName: v.optional(v.string()),
  /** The day the page says it was published (`2026-05-01`), when it parsed and was plausible. */
  publishedDate: v.optional(v.string()),
});

/** One cluster as the Summaries page shows it. */
export const clusterSummaryViewSchema = v.object({
  clusterId: v.string(),
  label: v.string(),
  factCount: v.number(),
  summary: v.nullable(
    v.object({
      statements: v.array(
        v.object({ text: v.string(), citations: v.array(summaryCitationSchema) }),
      ),
      isStale: v.boolean(),
      omittedFactCount: v.number(),
      generatedAt: v.number(),
      /** The model that wrote it, by name (REQ-LIN-005). */
      modelName: v.string(),
    }),
  ),
  /** A summary was asked for and has not been written yet. */
  isPending: v.boolean(),
});

export const clusterSummaryRequestSchemas = {
  /** The active session's clusters and their summaries. */
  "summaries.read": v.object({ sessionId: v.optional(v.string()) }),
  /** Summarise a cluster now, while the user is active ("Summarize now", "Refresh"). */
  "summaries.refresh": v.object({ clusterId: v.string(), sessionId: v.optional(v.string()) }),
  /** Select the Summaries tab, opening one if none is open. */
  "summaries.open": v.object({ sessionId: v.optional(v.string()) }),
} as const;

export const clusterSummaryResponseSchemas = {
  "summaries.view": v.object({
    session: v.nullable(
      v.object({
        title: v.string(),
        clusters: v.array(clusterSummaryViewSchema),
        canSummarize: v.boolean(),
      }),
    ),
  }),
  "summaries.refreshing": v.object({ clusterId: v.string(), queued: v.boolean() }),
  "summaries.opened": v.object({}),
} as const;

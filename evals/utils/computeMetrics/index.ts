import type { Metrics } from "../../types";
import type { MergeScore } from "../scoreMerges";

/** What one run counted, before it is turned into rates. */
export interface RunTotals {
  /** Facts the model answered with, whatever became of them. */
  answered: number;
  /** Of those, the ones whose quote is not in the passage. */
  ungrounded: number;
  /** Of those grounded, the ones whose subject cannot be a thing the page is about. */
  junk: number;
  /** Requests to extract facts, of which the next two are counted. */
  extractionRequests: number;
  invalidChunks: number;
  truncatedChunks: number;
  labelled: number;
  found: number;
  merge: MergeScore;
  statementCount: number;
  statementsNamingProduct: number;
  statementsComparing: number;
  cardCount: number;
  durationMs: number;
  requestCount: number;
}

/** `part` over `whole`, or `null` when there was no whole to measure against. */
const readShare = (part: number, whole: number): number | null =>
  whole === 0 ? null : part / whole;

/**
 * Turns a run's counts into the numbers it reports. A number with nothing
 * behind it — no labelled fact, no concept pair of a kind, no summary — is
 * `null`, never zero: a zero would read as a failure.
 */
export const computeMetrics = (totals: RunTotals): Metrics => ({
  junkSubjectRate: readShare(totals.junk, totals.answered),
  invalidAnswerRate: readShare(totals.invalidChunks, totals.extractionRequests),
  truncatedAnswerRate: readShare(totals.truncatedChunks, totals.extractionRequests),
  groundedRate: readShare(totals.answered - totals.ungrounded, totals.answered),
  labelRecall: readShare(totals.found, totals.labelled),
  mergeRecall: readShare(totals.merge.sameMerged, totals.merge.sameTotal),
  mergePrecision: readShare(totals.merge.differentApart, totals.merge.differentTotal),
  statementNamingRate: readShare(totals.statementsNamingProduct, totals.statementCount),
  statementComparingRate: readShare(totals.statementsComparing, totals.statementCount),
  cardCount: totals.cardCount,
  durationSeconds: Math.round(totals.durationMs / 100) / 10,
  requestCount: totals.requestCount,
});

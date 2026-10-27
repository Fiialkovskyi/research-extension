import { describe, expect, it } from "vitest";

import { computeMetrics, type RunTotals } from ".";

const totals: RunTotals = {
  answered: 20,
  ungrounded: 2,
  junk: 3,
  extractionRequests: 8,
  invalidChunks: 2,
  truncatedChunks: 4,
  labelled: 10,
  found: 8,
  merge: { sameTotal: 2, sameMerged: 1, differentTotal: 4, differentApart: 4 },
  statementCount: 5,
  statementsNamingProduct: 4,
  statementsComparing: 1,
  cardCount: 3,
  durationMs: 12_345,
  requestCount: 9,
};

describe("computeMetrics", () => {
  it("turns the counts into shares", () => {
    expect(computeMetrics(totals)).toEqual({
      junkSubjectRate: 0.15,
      invalidAnswerRate: 0.25,
      truncatedAnswerRate: 0.5,
      groundedRate: 0.9,
      labelRecall: 0.8,
      mergeRecall: 0.5,
      mergePrecision: 1,
      statementNamingRate: 0.8,
      statementComparingRate: 0.2,
      cardCount: 3,
      durationSeconds: 12.3,
      requestCount: 9,
    });
  });

  it("leaves a share null when there was nothing to measure it on", () => {
    const empty = computeMetrics({
      ...totals,
      answered: 0,
      ungrounded: 0,
      junk: 0,
      extractionRequests: 0,
      labelled: 0,
      found: 0,
      merge: { sameTotal: 0, sameMerged: 0, differentTotal: 0, differentApart: 0 },
      statementCount: 0,
      statementsNamingProduct: 0,
      statementsComparing: 0,
    });

    expect(empty.junkSubjectRate).toBeNull();
    expect(empty.groundedRate).toBeNull();
    expect(empty.invalidAnswerRate).toBeNull();
    expect(empty.truncatedAnswerRate).toBeNull();
    expect(empty.labelRecall).toBeNull();
    expect(empty.mergeRecall).toBeNull();
    expect(empty.mergePrecision).toBeNull();
    expect(empty.statementNamingRate).toBeNull();
  });
});

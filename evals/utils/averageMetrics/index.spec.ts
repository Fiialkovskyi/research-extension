import { describe, expect, it } from "vitest";

import type { Metrics } from "../../types";
import { averageMetrics } from ".";

const run = (labelRecall: number | null, cardCount: number): Metrics => ({
  junkSubjectRate: null,
  invalidAnswerRate: 0.1,
  truncatedAnswerRate: 0.2,
  groundedRate: 0.9,
  labelRecall,
  mergeRecall: null,
  mergePrecision: null,
  statementComparingRate: 0.3,
  statementNamingRate: null,
  cardCount,
  durationSeconds: 10,
  requestCount: 4,
});

describe("averageMetrics", () => {
  it("averages each number over the runs", () => {
    expect(averageMetrics([run(0.6, 2), run(0.8, 4)])).toMatchObject({
      labelRecall: 0.7,
      cardCount: 3,
      groundedRate: 0.9,
    });
  });

  it("leaves out a run that lacked a number, and keeps null when all did", () => {
    const mean = averageMetrics([run(null, 2), run(0.8, 4)]);

    expect(mean.labelRecall).toBe(0.8);
    expect(mean.junkSubjectRate).toBeNull();
  });

  it("is the run itself for one run", () => {
    expect(averageMetrics([run(0.5, 1)]).labelRecall).toBe(0.5);
  });
});

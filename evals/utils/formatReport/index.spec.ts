import { describe, expect, it } from "vitest";

import type { Metrics } from "../../types";
import { formatReport } from ".";

const metrics: Metrics = {
  junkSubjectRate: 0.1,
  invalidAnswerRate: 0.1,
  truncatedAnswerRate: 0.2,
  groundedRate: 0.95,
  labelRecall: 0.7,
  mergeRecall: null,
  mergePrecision: 1,
  statementComparingRate: 0.3,
  statementNamingRate: 0.5,
  cardCount: 4,
  durationSeconds: 30,
  requestCount: 12,
};

describe("formatReport", () => {
  it("shows a share as a percentage and a missing one as a dash", () => {
    const report = formatReport(metrics);

    expect(report).toContain("70.0%");
    expect(report).toMatch(/Concepts that should merge, merged\s+–/u);
  });

  it("shows the difference from the baseline in points", () => {
    const report = formatReport(metrics, { labelRecall: 0.8, cardCount: 3 });

    expect(report).toMatch(/Labelled facts found\s+70\.0%\s+80\.0%\s+−10 pts/u);
    expect(report).toMatch(/Product cards\s+4\s+3\s+\+1/u);
  });

  it("shows no difference for a number the baseline lacks", () => {
    const report = formatReport(metrics, { labelRecall: 0.8 });

    expect(report).toMatch(/Facts whose quote is on the page\s+95\.0%\s+–$/mu);
  });

  it("has no baseline column without a baseline", () => {
    expect(formatReport(metrics)).not.toContain("baseline");
  });
});

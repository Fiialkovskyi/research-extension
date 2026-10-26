import { describe, expect, it } from "vitest";

import { getWorkLabel } from ".";
import { SUMMARIZE_CLUSTER_JOB } from "@/features/clusterSummaries";
import { LIFETIME_PROBE_JOB } from "@/features/diagnostics";
import { RESOLVE_ENTITIES_JOB } from "@/features/entityResolution";
import { EXTRACT_FACTS_JOB } from "@/features/factExtraction";
import { SUGGEST_QUESTIONS_JOB } from "@/features/openQuestions";
import { EMBED_SNAPSHOT_JOB } from "@/features/snapshotEmbeddings";

describe("getWorkLabel", () => {
  it.each([
    [EMBED_SNAPSHOT_JOB, "Reading pages"],
    [EXTRACT_FACTS_JOB, "Extracting facts"],
    [RESOLVE_ENTITIES_JOB, "Matching entities"],
    [SUMMARIZE_CLUSTER_JOB, "Summarizing topics"],
    [SUGGEST_QUESTIONS_JOB, "Suggesting questions"],
  ])("names %s jobs in plain words", (type, label) => {
    expect(getWorkLabel(type)).toBe(label);
  });

  it("leaves diagnostics unnamed, so they are not shown", () => {
    expect(getWorkLabel(LIFETIME_PROBE_JOB)).toBeUndefined();
  });

  it("leaves a type it does not know unnamed, including inherited property names", () => {
    expect(getWorkLabel("somethingNew")).toBeUndefined();
    expect(getWorkLabel("toString")).toBeUndefined();
  });
});

/**
 * The job types the strip names, by the words it uses for each. Written out
 * rather than imported from the features that own them: this module reaches the
 * popup through the barrel, and those barrels would bring their features with
 * them. The spec of `getWorkLabel` checks they still match.
 */
export const WORK_LABELS: Readonly<Record<string, string>> = {
  embedSnapshot: "Reading pages",
  extractFacts: "Extracting facts",
  resolveEntities: "Matching entities",
  summarizeCluster: "Summarizing topics",
  suggestQuestions: "Suggesting questions",
};

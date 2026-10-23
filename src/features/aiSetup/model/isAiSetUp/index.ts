import type { StoredModel } from "@/shared/storage";

/**
 * Whether AI is set up: an embedding model is active and passed its checks.
 *
 * Only the embedding family counts. Similar pages, clusters and the map rest on
 * it; a text-generation model still downloading must not make AI look unset.
 */
export const isAiSetUp = (models: readonly StoredModel[]): boolean =>
  models.some(
    (model) =>
      model.manifest.contract.family === "embedding" &&
      model.active &&
      model.conformance === "passed",
  );

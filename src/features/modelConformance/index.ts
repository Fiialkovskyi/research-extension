/**
 * Deciding whether a loaded model actually works, before anything relies on it.
 *
 * Step 6 of the pipeline, and the reason step 5 (loading) is not enough. A model
 * that loads is not a model that works, and the failure mode of a
 * misconfigured encoder is not an error: it returns vectors of exactly the
 * declared width, at unit length, that encode nothing useful. Nothing
 * downstream can detect that, so it is detected here or not at all.
 *
 * Deliberately provider-agnostic: the suite takes a function that embeds text
 * and knows nothing about where that function came from. That is what will let
 * it judge the native host's output on the same terms as the in-extension
 * runtime's.
 */

export {
  EXTRACTION_PROBES,
  MINIMUM_DETERMINISM_SIMILARITY,
  MINIMUM_ORDERED_PROBES,
  NORM_TOLERANCE,
  PARAPHRASE_PROBES,
} from "./constants";
export type {
  ConformanceOutcome,
  EmbedForConformance,
  ExtractionProbe,
  GenerateForConformance,
  ParaphraseProbe,
  ProbeResult,
} from "./types";
export { runEmbeddingConformance } from "./model/runEmbeddingConformance";
export { runGenerationConformance } from "./model/runGenerationConformance";

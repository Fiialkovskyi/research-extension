import { type EmbedForConformance, MINIMUM_DETERMINISM_SIMILARITY } from "../../../../constants";
import type { ProbeResult } from "../buildProbeResults";
import { getCosineSimilarity } from "../getCosineSimilarity";

/**
 * Checks that embedding the same text twice reproduces the same vector.
 *
 * Needs its own calls, which is why it sits apart from the arithmetic probes.
 * It catches a runtime that is non-deterministic across calls — a race in
 * session reuse, a device that quietly changed — any of which would make stored
 * vectors incomparable with freshly computed ones even though both look
 * perfectly well-formed.
 */
export const buildDeterminismProbe = async (
  anchors: readonly string[],
  embed: EmbedForConformance,
): Promise<ProbeResult> => {
  const [first] = anchors;

  if (first === undefined) {
    return { name: "reproduces a vector", passed: false, detail: "No probe text to re-embed" };
  }

  // Both embeddings are of the same single text, in the same role, in a batch
  // of the same shape. Comparing a vector taken from a batch of twenty against
  // one taken alone measures something else entirely: batch width changes the
  // padded sequence length, and under quantization that moves the result by
  // about half a percent — a real effect, but not what determinism means.
  const [once] = await embed([first], "query");
  const [twice] = await embed([first], "query");

  if (once === undefined || twice === undefined) {
    return { name: "reproduces a vector", passed: false, detail: "Re-embedding returned nothing" };
  }

  const similarity = getCosineSimilarity(once, twice);

  return {
    name: "reproduces a vector",
    passed: similarity >= MINIMUM_DETERMINISM_SIMILARITY,
    detail: `Embedding the same text twice gave a similarity of ${similarity.toFixed(5)}, ${MINIMUM_DETERMINISM_SIMILARITY} required`,
  };
};

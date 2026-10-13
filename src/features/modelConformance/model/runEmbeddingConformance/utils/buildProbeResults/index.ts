import type { EmbeddingContract } from "@/shared/modelManifest";
import { MINIMUM_ORDERED_PROBES, NORM_TOLERANCE, PARAPHRASE_PROBES } from "../../../../constants";
import { getCosineSimilarity } from "../getCosineSimilarity";
import type { ProbeResult } from "../../../../types";
import { getVectorNorm } from "../getVectorNorm";

/**
 * Judges a model's vectors against the contract it declared.
 *
 * The whole pure half of the conformance suite: given the vectors, every
 * verdict here is arithmetic, which is what lets each failure mode be tested
 * without a model. Ordering is judged only when the structural probes pass,
 * because comparing mis-sized or degenerate vectors produces a number that
 * looks like a score and means nothing.
 *
 * @param anchorVectors one per probe, embedded in the query role.
 * @param otherVectors paraphrase and stranger interleaved, two per probe.
 */
export const buildProbeResults = (
  contract: EmbeddingContract,
  anchorVectors: readonly Float32Array[],
  otherVectors: readonly Float32Array[],
): ProbeResult[] => {
  const everyVector = [...anchorVectors, ...otherVectors];
  const probes: ProbeResult[] = [
    buildCountProbe(anchorVectors.length, otherVectors.length),
    buildDimensionsProbe(everyVector, contract.dimensions),
  ];

  if (contract.normalize) {
    probes.push(buildNormProbe(everyVector));
  }

  if (probes.every((probe) => probe.passed)) {
    probes.push(buildOrderingProbe(anchorVectors, otherVectors));
  }

  return probes;
};

const buildCountProbe = (anchorCount: number, otherCount: number): ProbeResult => {
  // Counted against the suite's own probe data rather than against the arrays
  // themselves. Comparing the vectors to their own length would be a tautology
  // that could never fail, which is worse than having no probe at all.
  const expectedAnchors = PARAPHRASE_PROBES.length;
  const expectedOthers = expectedAnchors * 2;
  const passed = anchorCount === expectedAnchors && otherCount === expectedOthers;

  return {
    name: "returns one vector per text",
    passed,
    detail: passed
      ? `${anchorCount + otherCount} vectors for ${expectedAnchors + expectedOthers} texts`
      : `Expected ${expectedAnchors + expectedOthers} vectors but got ${anchorCount + otherCount}`,
  };
};

const buildDimensionsProbe = (
  vectors: readonly Float32Array[],
  dimensions: number,
): ProbeResult => {
  const wrong = vectors.find((vector) => vector.length !== dimensions);

  return {
    name: "matches its declared dimensionality",
    passed: wrong === undefined,
    detail:
      wrong === undefined
        ? `every vector has ${dimensions} dimensions`
        : `Declares ${dimensions} dimensions but returned a vector of ${wrong.length}`,
  };
};

const buildNormProbe = (vectors: readonly Float32Array[]): ProbeResult => {
  const offending = vectors
    .map((vector) => getVectorNorm(vector))
    .find((norm) => Math.abs(norm - 1) > NORM_TOLERANCE);

  return {
    name: "normalizes as declared",
    passed: offending === undefined,
    detail:
      offending === undefined
        ? "every vector is unit length"
        : `Declares normalized output but returned a vector of length ${offending.toFixed(4)}`,
  };
};

const buildOrderingProbe = (
  anchors: readonly Float32Array[],
  others: readonly Float32Array[],
): ProbeResult => {
  let ordered = 0;

  for (const [index, anchor] of anchors.entries()) {
    const paraphrase = others[index * 2];
    const unrelated = others[index * 2 + 1];

    if (anchor === undefined || paraphrase === undefined || unrelated === undefined) {
      continue;
    }

    if (getCosineSimilarity(anchor, paraphrase) > getCosineSimilarity(anchor, unrelated)) {
      ordered += 1;
    }
  }

  return {
    name: "places a paraphrase closer than a stranger",
    passed: ordered >= MINIMUM_ORDERED_PROBES,
    detail: `${ordered} of ${anchors.length} pairs ordered correctly, ${MINIMUM_ORDERED_PROBES} required`,
  };
};

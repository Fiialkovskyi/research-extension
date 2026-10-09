import { getErrorMessage } from "@/shared/getErrorMessage";
import type { EmbeddingContract } from "@/shared/modelManifest";
import { type EmbedForConformance } from "../../types";
import { PARAPHRASE_PROBES } from "../../constants";
import { buildDeterminismProbe } from "./utils/buildDeterminismProbe";
import { buildProbeResults, type ProbeResult } from "./utils/buildProbeResults";

export type ConformanceOutcome =
  | { passed: true; probes: ProbeResult[] }
  | {
      passed: false;
      probes: ProbeResult[];
      /** Why the suite failed, suitable for showing a user. */
      reason: string;
    };

/**
 * Runs the embedding family's conformance suite.
 *
 * A model that loads is not a model that works, and the failure mode of a
 * misconfigured encoder is not an error: it returns vectors of exactly the
 * declared width, at unit length, that encode nothing useful. Nothing
 * downstream can detect that, so it is detected here or not at all.
 *
 * Anchors are embedded as queries and the rest as documents. For a model with
 * no prefixes that is identical to embedding everything one way; for a model
 * that instructs the query side it is how the model is meant to be used, so a
 * prefix applied to the wrong side shows up as a drop in ordering accuracy
 * rather than passing unnoticed.
 *
 * Never throws: a model that fails, or whose runtime fails, yields a failed
 * outcome with a reason, because the caller's job is to refuse activation and
 * explain why rather than to handle an exception.
 */
export const runEmbeddingConformance = async (
  contract: EmbeddingContract,
  embed: EmbedForConformance,
): Promise<ConformanceOutcome> => {
  try {
    return await runProbes(contract, embed);
  } catch (error) {
    const reason = getErrorMessage(error);

    return {
      passed: false,
      probes: [{ name: "runs at all", passed: false, detail: reason }],
      reason,
    };
  }
};

const runProbes = async (
  contract: EmbeddingContract,
  embed: EmbedForConformance,
): Promise<ConformanceOutcome> => {
  const anchors = PARAPHRASE_PROBES.map((probe) => probe.anchor);
  const others = PARAPHRASE_PROBES.flatMap((probe) => [probe.paraphrase, probe.unrelated]);

  const [anchorVectors, otherVectors] = await Promise.all([
    embed(anchors, "query"),
    embed(others, "document"),
  ]);

  const probes: ProbeResult[] = buildProbeResults(contract, anchorVectors, otherVectors);

  // Determinism needs a second call, so it belongs with the orchestration
  // rather than with the arithmetic. Skipped when the structural probes already
  // failed: re-embedding to compare mis-sized vectors answers nothing.
  if (probes.every((probe) => probe.passed)) {
    probes.push(await buildDeterminismProbe(anchors, embed));
  }

  const failed = probes.filter((probe) => !probe.passed);

  if (failed.length === 0) {
    return { passed: true, probes };
  }

  return { passed: false, probes, reason: failed.map((probe) => probe.detail).join("; ") };
};

export type { EmbedForConformance } from "../../types";
export type { ProbeResult } from "./utils/buildProbeResults";

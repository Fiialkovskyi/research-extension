import type { ModelProfile } from "@/shared/config";
import type { ModelContract } from "@/shared/modelManifest";
import type { ModelLimits } from "../readModelLimits";

/**
 * Turns what a repository publishes, plus what its profile declares, into the
 * contract a model is held to.
 *
 * Separated from manifest assembly because this is where the two sources meet
 * and where the family decides which published limit means what: for an
 * encoder the bound is how much text it can take, for a generative model it is
 * how much context it can attend to.
 *
 * @throws when the repository publishes none of the values a profile is not
 *   allowed to declare on its behalf.
 */
export const buildModelContract = (profile: ModelProfile, limits: ModelLimits): ModelContract => {
  if (profile.contract.family === "embedding") {
    if (limits.hiddenSize === undefined) {
      throw new Error(
        `${profile.repository} does not publish a hidden size, so its embedding ` +
          `dimensionality cannot be derived. A profile must not guess it.`,
      );
    }

    const bounds = [limits.modelMaxLength, limits.maxPositionEmbeddings].filter(
      (bound): bound is number => bound !== undefined,
    );

    if (bounds.length === 0) {
      throw new Error(
        `${profile.repository} publishes no input length, so the longest text it ` +
          `can embed is unknown.`,
      );
    }

    return {
      family: "embedding",
      dimensions: limits.hiddenSize,
      maxInputTokens: Math.min(...bounds),
      pooling: profile.contract.pooling,
      normalize: profile.contract.normalize,
      similarity: profile.contract.similarity,
      prefixes: profile.contract.prefixes,
    };
  }

  if (limits.maxPositionEmbeddings === undefined) {
    throw new Error(
      `${profile.repository} publishes no position limit, so its context window ` +
        `cannot be derived.`,
    );
  }

  return {
    family: "text-generation",
    contextWindow: limits.maxPositionEmbeddings,
    maxNewTokens: profile.contract.maxNewTokens,
    chatTemplate: profile.contract.chatTemplate,
    structuredOutput: profile.contract.structuredOutput,
  };
};

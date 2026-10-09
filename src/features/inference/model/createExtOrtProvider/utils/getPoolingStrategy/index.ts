import type { EmbeddingContract } from "@/shared/modelManifest";

/** Pooling strategies this provider can apply. */
export type PoolingStrategy = "mean" | "cls";

/**
 * Maps a contract's declared pooling onto what this provider supports.
 *
 * `last_token` is declared in the contract because some models use it, but this
 * provider's feature-extraction path offers mean and cls only. Refusing it
 * loudly here is the point: pooling the wrong way produces vectors that look
 * entirely plausible — right length, unit norm — and encode nothing useful, so
 * a silent substitution would be the hardest possible bug to notice.
 *
 * @throws when the contract declares a strategy this provider cannot apply.
 */
export const getPoolingStrategy = (contract: EmbeddingContract): PoolingStrategy => {
  if (contract.pooling === "mean" || contract.pooling === "cls") {
    return contract.pooling;
  }

  throw new Error(
    `This provider cannot apply "${contract.pooling}" pooling. ` +
      `Pooling the wrong way yields plausible but meaningless vectors, so the model ` +
      `is refused rather than approximated.`,
  );
};

import type { EmbeddingRole } from "@/features/inference";

/**
 * Embeds a batch of texts in a role.
 *
 * Injected throughout the suite rather than imported, so every probe runs
 * against a stub and each failure mode is reachable without a real model.
 */
export type EmbedForConformance = (
  texts: readonly string[],
  role: EmbeddingRole,
) => Promise<Float32Array[]>;

/** A probe pair: the paraphrase should sit closer to the anchor than the stranger. */
export interface ParaphraseProbe {
  anchor: string;
  paraphrase: string;
  unrelated: string;
}

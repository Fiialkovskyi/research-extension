import type { EmbeddingRole, GenerateRequest, GenerationStream } from "@/features/inference";

/** One probe's verdict, named so a refusal can say what failed. */
export interface ProbeResult {
  name: string;
  passed: boolean;
  detail: string;
}

/** What a family's suite decided, with every probe, whichever family it judged. */
export type ConformanceOutcome =
  | { passed: true; probes: ProbeResult[] }
  | {
      passed: false;
      probes: ProbeResult[];
      /** Why the suite failed, suitable for showing a user. */
      reason: string;
    };

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

/** Generates with the model under judgement, exactly as features will. */
export type GenerateForConformance = (request: GenerateRequest) => GenerationStream;

/** A passage describing one product, and what extracting it should give. */
export interface ExtractionProbe {
  passage: string;
  expected: { name: string; priceUsd: number; weightKg: number };
}

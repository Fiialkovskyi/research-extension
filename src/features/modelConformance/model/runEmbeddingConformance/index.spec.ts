import { describe, expect, it, vi } from "vitest";

import { runEmbeddingConformance } from ".";
import { type EmbedForConformance, PARAPHRASE_PROBES } from "../../constants";
import type { EmbeddingContract } from "@/shared/modelManifest";

const DIMENSIONS = 4;

const contract = (overrides: Partial<EmbeddingContract> = {}): EmbeddingContract => ({
  family: "embedding",
  dimensions: DIMENSIONS,
  maxInputTokens: 512,
  pooling: "mean",
  normalize: true,
  similarity: "cosine",
  prefixes: { query: "", document: "" },
  ...overrides,
});

const unit = (values: readonly number[]): Float32Array => {
  const norm = Math.sqrt(values.reduce((total, value) => total + value * value, 0));

  return new Float32Array(values.map((value) => value / norm));
};

/**
 * A lookup shaped like a working encoder's output: each paraphrase nearly
 * parallel to its anchor, each stranger orthogonal.
 */
const buildLookup = (swapPairs = 0): Map<string, Float32Array> => {
  const lookup = new Map<string, Float32Array>();

  for (const [index, probe] of PARAPHRASE_PROBES.entries()) {
    const angle = (index * Math.PI) / PARAPHRASE_PROBES.length;
    const near = unit([Math.cos(angle + 0.01), Math.sin(angle + 0.01), 0, 0]);
    const far = unit([0, 0, Math.cos(angle), Math.sin(angle)]);
    const swapped = index < swapPairs;

    lookup.set(probe.anchor, unit([Math.cos(angle), Math.sin(angle), 0, 0]));
    lookup.set(probe.paraphrase, swapped ? far : near);
    lookup.set(probe.unrelated, swapped ? near : far);
  }

  return lookup;
};

interface EmbedBehaviour {
  swapPairs?: number;
  scale?: number;
  dimensions?: number;
  nonDeterministic?: boolean;
  throws?: string;
}

const buildEmbed = (behaviour: EmbedBehaviour = {}): EmbedForConformance => {
  const lookup = buildLookup(behaviour.swapPairs);
  let calls = 0;

  return vi.fn((texts: readonly string[]) => {
    calls += 1;

    if (behaviour.throws !== undefined) {
      return Promise.reject(new Error(behaviour.throws));
    }

    return Promise.resolve(
      texts.map((text) => {
        const base = lookup.get(text) ?? unit([1, 0, 0, 0]);

        if (behaviour.dimensions !== undefined) {
          return new Float32Array(behaviour.dimensions).fill(1 / Math.sqrt(behaviour.dimensions));
        }

        // Calls one and two are the probe batches; three and four are the
        // determinism probe embedding the same text twice. Diverging on the
        // fourth is what a reused session with leftover state looks like.
        if (behaviour.nonDeterministic === true && calls >= 4) {
          return unit([0, 0, 1, 1]);
        }

        return behaviour.scale === undefined
          ? base
          : new Float32Array(base.map((value) => value * (behaviour.scale ?? 1)));
      }),
    );
  }) as unknown as EmbedForConformance;
};

describe("runEmbeddingConformance", () => {
  it("passes a model that behaves", async () => {
    const outcome = await runEmbeddingConformance(contract(), buildEmbed());

    expect(outcome.passed).toBe(true);
    expect(outcome.reason).toBeUndefined();
  });

  it("embeds anchors as queries and the rest as documents", async () => {
    // For a model that instructs the query side, this is how it is meant to be
    // used — so a prefix applied to the wrong side shows up as poor ordering.
    const embed = buildEmbed();

    await runEmbeddingConformance(contract(), embed);

    expect(embed).toHaveBeenCalledWith(expect.any(Array), "query");
    expect(embed).toHaveBeenCalledWith(expect.any(Array), "document");
  });

  it("sends every probe pair, not a sample", async () => {
    const embed = buildEmbed();

    await runEmbeddingConformance(contract(), embed);

    const [anchorCall] = vi.mocked(embed).mock.calls;

    expect(anchorCall?.[0]).toHaveLength(PARAPHRASE_PROBES.length);
  });

  it("fails a model whose vectors are the wrong width", async () => {
    const outcome = await runEmbeddingConformance(
      contract(),
      buildEmbed({ dimensions: DIMENSIONS + 2 }),
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toMatch(/dimensions/);
  });

  it("fails a model that declares normalization and does not deliver it", async () => {
    const outcome = await runEmbeddingConformance(contract(), buildEmbed({ scale: 4 }));

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toMatch(/normalized/);
  });

  it("fails a model that cannot reproduce its own vector", async () => {
    const outcome = await runEmbeddingConformance(
      contract(),
      buildEmbed({ nonDeterministic: true }),
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toMatch(/similarity of/);
  });

  it("fails a model that puts strangers closer than paraphrases", async () => {
    const outcome = await runEmbeddingConformance(
      contract(),
      buildEmbed({ swapPairs: PARAPHRASE_PROBES.length }),
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toMatch(/ordered correctly/);
  });

  it("tolerates a couple of wrong pairs, which no model gets perfect", async () => {
    const outcome = await runEmbeddingConformance(contract(), buildEmbed({ swapPairs: 2 }));

    expect(outcome.passed).toBe(true);
  });

  it("reports a runtime failure as a refusal rather than throwing", async () => {
    // The caller's job is to refuse activation and explain why.
    const outcome = await runEmbeddingConformance(
      contract(),
      buildEmbed({ throws: "no WebAssembly backend" }),
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("no WebAssembly backend");
  });

  it("names every probe it ran, so a surface can show the detail", async () => {
    const outcome = await runEmbeddingConformance(contract(), buildEmbed());

    expect(outcome.probes.map((probe) => probe.name)).toEqual([
      "returns one vector per text",
      "matches its declared dimensionality",
      "normalizes as declared",
      "places a paraphrase closer than a stranger",
      "reproduces a vector",
    ]);
  });

  it("skips the normalization probe for a model that declares none", async () => {
    const outcome = await runEmbeddingConformance(
      contract({ normalize: false }),
      buildEmbed({ scale: 4 }),
    );

    expect(outcome.probes.map((probe) => probe.name)).not.toContain("normalizes as declared");
    expect(outcome.passed).toBe(true);
  });

  it("does not re-embed when a structural probe already failed", async () => {
    const embed = buildEmbed({ dimensions: DIMENSIONS + 2 });

    await runEmbeddingConformance(contract(), embed);

    // Two calls for the two roles, and none for determinism.
    expect(vi.mocked(embed).mock.calls).toHaveLength(2);
  });

  it("compares like with like when checking determinism", async () => {
    // Both embeddings must come from a batch of the same shape: batch width
    // changes the padded sequence length, which moves the result under
    // quantization and would read as non-determinism.
    const embed = buildEmbed();

    await runEmbeddingConformance(contract(), embed);

    const determinismCalls = vi.mocked(embed).mock.calls.slice(2);

    expect(determinismCalls).toHaveLength(2);
    expect(determinismCalls[0]).toEqual(determinismCalls[1]);
  });
});

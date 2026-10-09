import { describe, expect, it } from "vitest";

import type { GenerationStream, LoadedModel } from "./types";
import type { ModelManifest } from "@/shared/modelManifest";

/**
 * The provider contract has to fit both families before either is implemented.
 *
 * Designing it around embeddings alone would produce an interface shaped by
 * batch-in, vectors-out, which a streaming, cancellable, template-rendering
 * generation call does not fit — and phase B would rewrite it. These stubs are
 * the cheap way to find that out now: they compile only if the contract already
 * accommodates both.
 */

const manifest = { reference: { repository: "owner/model" } } as unknown as ModelManifest;

const embeddingModel: LoadedModel = {
  family: "embedding",
  manifest,
  device: "wasm",
  embed: ({ texts }) =>
    Promise.resolve({ vectors: texts.map(() => new Float32Array(2)), device: "wasm" }),
  unload: () => Promise.resolve(),
};

const generationModel: LoadedModel = {
  family: "text-generation",
  manifest,
  device: "webgpu",
  generate: ({ maxTokens, signal }): GenerationStream => {
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield { delta: "hello" };
      },
      final: () =>
        Promise.resolve({
          text: "hello",
          device: "webgpu" as const,
          stoppedBecause:
            signal?.aborted === true
              ? ("cancelled" as const)
              : maxTokens <= 1
                ? ("token-limit" as const)
                : ("model" as const),
        }),
    };

    return stream;
  },
  unload: () => Promise.resolve(),
};

describe("the loaded-model contract", () => {
  it("accommodates an embedding model", async () => {
    if (embeddingModel.family !== "embedding") {
      throw new Error("unreachable");
    }

    const { vectors, device } = await embeddingModel.embed({
      texts: ["a", "b"],
      role: "document",
    });

    expect(vectors).toHaveLength(2);
    expect(device).toBe("wasm");
  });

  it("accommodates a generative model that streams and then concludes", async () => {
    if (generationModel.family !== "text-generation") {
      throw new Error("unreachable");
    }

    const stream = generationModel.generate({
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 16,
    });

    const deltas: string[] = [];

    for await (const chunk of stream) {
      deltas.push(chunk.delta);
    }

    expect(deltas).toEqual(["hello"]);
    expect(await stream.final()).toMatchObject({ stoppedBecause: "model" });
  });

  it("lets a generative model report that it was cancelled", async () => {
    if (generationModel.family !== "text-generation") {
      throw new Error("unreachable");
    }

    const controller = new AbortController();

    controller.abort();

    const stream = generationModel.generate({
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 16,
      signal: controller.signal,
    });

    expect(await stream.final()).toMatchObject({ stoppedBecause: "cancelled" });
  });

  it("discriminates the two families on one field", () => {
    // A caller narrows with a single check rather than probing for methods.
    const families = [embeddingModel, generationModel].map((model) => model.family);

    expect(families).toEqual(["embedding", "text-generation"]);
  });
});

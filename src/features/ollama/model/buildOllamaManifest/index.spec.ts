import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";

import { buildOllamaManifest } from ".";
import { OLLAMA_PROFILES } from "@/shared/config";
import { modelManifestSchema } from "@/shared/modelManifest";

const ORIGIN = "http://127.0.0.1:11434";
const MODEL = {
  name: "nomic-embed-text:latest",
  digest: "a".repeat(64),
  size: 274_000_000,
  details: { family: "nomic-bert", quantization_level: "F16" },
};

const show = (
  modelInfo: Record<string, unknown>,
  license = "Apache License\nVersion 2.0",
  capabilities?: string[],
) =>
  vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ license, model_info: modelInfo, capabilities }), {
        status: 200,
      }),
    ),
  );

const QWEN = { name: "qwen3:4b", digest: "b".repeat(64), size: 2_500_000_000 };

/** What `/api/show` answers for a chat model: it has an embedding length too, its hidden size. */
const QWEN_INFO = {
  "general.architecture": "qwen3",
  "qwen3.embedding_length": 2560,
  "qwen3.context_length": 40960,
};

describe("buildOllamaManifest", () => {
  it("pins the model to its digest, with dimensions and context from Ollama and prefixes from its profile", async () => {
    const fetchResource = show({
      "general.architecture": "nomic-bert",
      "nomic-bert.embedding_length": 768,
      "nomic-bert.context_length": 2048,
    });
    const manifest = await buildOllamaManifest(
      fetchResource,
      ORIGIN,
      MODEL,
      OLLAMA_PROFILES.find(({ name }) => name === "nomic-embed-text"),
    );

    expect(manifest).toMatchObject({
      reference: { hub: "ollama", repository: "nomic-embed-text:latest", revision: "a".repeat(64) },
      format: "local-server",
      quantization: "F16",
      files: [],
      license: "Apache License",
      contract: {
        family: "embedding",
        dimensions: 768,
        maxInputTokens: 2048,
        normalize: true,
        similarity: "cosine",
        prefixes: { query: "search_query: ", document: "search_document: " },
      },
    });
    expect(v.safeParse(modelManifestSchema, manifest).success).toBe(true);
    expect(fetchResource).toHaveBeenCalledWith(`${ORIGIN}/api/show`, {
      method: "POST",
      body: JSON.stringify({ model: "nomic-embed-text:latest" }),
    });
  });

  it("uses no prefixes for a model without a profile", async () => {
    const manifest = await buildOllamaManifest(
      show({ "general.architecture": "bert", "bert.embedding_length": 384 }),
      ORIGIN,
      MODEL,
      undefined,
    );

    expect(manifest.contract).toMatchObject({
      dimensions: 384,
      maxInputTokens: 512,
      prefixes: { query: "", document: "" },
    });
  });

  it("refuses a model whose dimensions Ollama does not give", async () => {
    await expect(
      buildOllamaManifest(show({ "general.architecture": "llama" }), ORIGIN, MODEL, undefined),
    ).rejects.toThrow("how many dimensions");
  });

  it("describes a model the server says completes text as a generation model", async () => {
    const manifest = await buildOllamaManifest(
      show(QWEN_INFO, "Apache License", ["completion", "tools", "thinking"]),
      ORIGIN,
      QWEN,
      undefined,
    );

    expect(manifest.contract).toEqual({
      family: "text-generation",
      contextWindow: 40960,
      maxNewTokens: 2048,
      chatTemplate: "server",
      structuredOutput: "json_schema",
    });
    expect(v.safeParse(modelManifestSchema, manifest).success).toBe(true);
  });

  it("believes the server over a profile", async () => {
    const manifest = await buildOllamaManifest(
      show(QWEN_INFO, "Apache License", ["embedding"]),
      ORIGIN,
      QWEN,
      OLLAMA_PROFILES.find(({ name }) => name === "qwen3:4b"),
    );

    expect(manifest.contract).toMatchObject({ family: "embedding", dimensions: 2560 });
  });

  it("falls back to the profile when the server does not say what the model does", async () => {
    const manifest = await buildOllamaManifest(
      show(QWEN_INFO),
      ORIGIN,
      QWEN,
      OLLAMA_PROFILES.find(({ name }) => name === "qwen3:4b"),
    );

    expect(manifest.contract.family).toBe("text-generation");
  });

  it("keeps a generation model's token limit within a small context window", async () => {
    const manifest = await buildOllamaManifest(
      show({ "general.architecture": "tiny", "tiny.context_length": 1024 }, "MIT", ["completion"]),
      ORIGIN,
      QWEN,
      undefined,
    );

    expect(manifest.contract).toMatchObject({ contextWindow: 1024, maxNewTokens: 1024 });
  });
});

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

const show = (modelInfo: Record<string, unknown>, license = "Apache License\nVersion 2.0") =>
  vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ license, model_info: modelInfo }), { status: 200 }),
    ),
  );

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
});

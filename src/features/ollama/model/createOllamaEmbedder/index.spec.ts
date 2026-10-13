import { describe, expect, it, vi } from "vitest";

import { createOllamaEmbedder } from ".";
import type { ModelManifest } from "@/shared/modelManifest";

const ORIGIN = "http://127.0.0.1:11434";
const DIGEST = "a".repeat(64);

const MANIFEST: ModelManifest = {
  manifestVersion: 1,
  reference: { hub: "ollama", repository: "nomic-embed-text:latest", revision: DIGEST },
  format: "local-server",
  files: [],
  license: "Apache License",
  contract: {
    family: "embedding",
    dimensions: 3,
    maxInputTokens: 2048,
    pooling: "mean",
    normalize: true,
    similarity: "cosine",
    prefixes: { query: "search_query: ", document: "search_document: " },
  },
};

/** A fake Ollama: what `/api/tags` lists, and what `/api/embed` answers. */
const createServer = ({ digest = DIGEST, dimensions = 3 } = {}) => {
  const embedded: unknown[] = [];
  const fetchResource = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/api/tags")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ models: [{ name: "nomic-embed-text:latest", digest, size: 1 }] }),
        ),
      );
    }

    if (url.endsWith("/api/show")) {
      return Promise.resolve(new Response('{"error":"model is required"}', { status: 400 }));
    }

    const { input } = JSON.parse(String(init?.body)) as { input: string[] };

    embedded.push(input);

    return Promise.resolve(
      new Response(
        JSON.stringify({
          embeddings: input.map(() => Array.from({ length: dimensions }, () => 0.5)),
        }),
      ),
    );
  });

  return { fetchResource, embedded };
};

describe("createOllamaEmbedder", () => {
  it("embeds in one request, with the model's prefix for the role", async () => {
    const server = createServer();
    const vectors = await createOllamaEmbedder(server.fetchResource, ORIGIN, MANIFEST).embed(
      ["mid-drive motors", "hub motors"],
      "document",
    );

    expect(server.embedded).toEqual([
      ["search_document: mid-drive motors", "search_document: hub motors"],
    ]);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toBeInstanceOf(Float32Array);
  });

  it("refuses vectors of the wrong dimensions", async () => {
    await expect(
      createOllamaEmbedder(createServer({ dimensions: 4 }).fetchResource, ORIGIN, MANIFEST).embed(
        ["x"],
        "query",
      ),
    ).rejects.toThrow("not of 3 dimensions");
  });

  it("refuses a model re-pulled since it was registered", async () => {
    await expect(
      createOllamaEmbedder(
        createServer({ digest: "b".repeat(64) }).fetchResource,
        ORIGIN,
        MANIFEST,
      ).embed(["x"], "query"),
    ).rejects.toThrow("changed in Ollama");
  });

  it("says Ollama is not running when nothing answers", async () => {
    const fetchResource = vi.fn(() => Promise.reject(new TypeError("NetworkError")));

    await expect(
      createOllamaEmbedder(fetchResource, ORIGIN, MANIFEST).embed(["x"], "query"),
    ).rejects.toThrow("Ollama is not running at http://127.0.0.1:11434");
  });
});

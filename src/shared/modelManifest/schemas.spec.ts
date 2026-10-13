import * as v from "valibot";
import { describe, expect, it } from "vitest";

import {
  commitRevisionSchema,
  modelContractSchema,
  modelFileSchema,
  modelManifestSchema,
  modelReferenceSchema,
} from "./schemas";

const validRevision = "751bff37182d3f1213fa05d7196b954e230abad9";
const validDigest = "a".repeat(64);

const validManifest = {
  manifestVersion: 1,
  reference: { hub: "huggingface", repository: "Xenova/all-MiniLM-L6-v2", revision: validRevision },
  format: "onnx",
  quantization: "q8",
  files: [
    {
      path: "onnx/model_quantized.onnx",
      digest: { algorithm: "sha256", value: validDigest },
      bytes: 1,
    },
  ],
  license: "Apache-2.0",
  contract: {
    family: "embedding",
    dimensions: 384,
    maxInputTokens: 256,
    pooling: "mean",
    normalize: true,
    similarity: "cosine",
    prefixes: { query: "", document: "" },
  },
};

const isAccepted = (schema: v.GenericSchema, value: unknown) => v.safeParse(schema, value).success;

/** A manifest file entry carrying the digest under test. */
const buildFile = (digest: unknown) => ({ path: "model.onnx", digest, bytes: 1 });

describe("commitRevisionSchema", () => {
  it("accepts a 40-character lowercase hexadecimal identifier", () => {
    expect(isAccepted(commitRevisionSchema, validRevision)).toBe(true);
  });

  it.each([
    ["a branch name", "main"],
    ["a short identifier", validRevision.slice(0, 7)],
    ["an over-long identifier", `${validRevision}0`],
    ["uppercase hexadecimal", validRevision.toUpperCase()],
    ["a non-hexadecimal character", `${validRevision.slice(0, 39)}z`],
  ])("refuses %s, so a mutable reference cannot be recorded as pinned", (_label, candidate) => {
    expect(isAccepted(commitRevisionSchema, candidate)).toBe(false);
  });
});

describe("modelReferenceSchema", () => {
  it("accepts an owner and name pair", () => {
    expect(isAccepted(modelReferenceSchema, validManifest.reference)).toBe(true);
  });

  it.each([
    ["a bare name", "model"],
    ["a nested path", "owner/group/model"],
    ["an embedded space", "owner/my model"],
  ])("refuses %s as a repository", (_label, repository) => {
    expect(isAccepted(modelReferenceSchema, { ...validManifest.reference, repository })).toBe(
      false,
    );
  });

  it("accepts an Ollama model name pinned to its digest", () => {
    expect(
      isAccepted(modelReferenceSchema, {
        hub: "ollama",
        repository: "nomic-embed-text:latest",
        revision: validDigest,
      }),
    ).toBe(true);
  });

  it("refuses an Ollama model pinned to anything but a full digest", () => {
    expect(
      isAccepted(modelReferenceSchema, {
        hub: "ollama",
        repository: "nomic-embed-text:latest",
        revision: validRevision,
      }),
    ).toBe(false);
  });

  it("refuses a hub it does not know", () => {
    expect(isAccepted(modelReferenceSchema, { ...validManifest.reference, hub: "elsewhere" })).toBe(
      false,
    );
  });
});

describe("modelFileSchema", () => {
  it("accepts a path with its digest and size", () => {
    expect(isAccepted(modelFileSchema, validManifest.files[0])).toBe(true);
  });

  it("accepts a git object hash, which is all the hub publishes for a small file", () => {
    expect(
      isAccepted(modelFileSchema, buildFile({ algorithm: "git-blob-sha1", value: validRevision })),
    ).toBe(true);
  });

  it.each([
    ["a truncated digest", validDigest.slice(0, 32)],
    ["an uppercase digest", validDigest.toUpperCase()],
    ["a git-length value", validRevision],
  ])("refuses %s as a SHA-256", (_label, value) => {
    expect(isAccepted(modelFileSchema, buildFile({ algorithm: "sha256", value }))).toBe(false);
  });

  it("refuses a SHA-256 value declared as a git object hash", () => {
    expect(
      isAccepted(modelFileSchema, buildFile({ algorithm: "git-blob-sha1", value: validDigest })),
    ).toBe(false);
  });

  it.each([
    ["a missing digest", undefined],
    ["a bare string", validDigest],
    ["an unknown algorithm", { algorithm: "md5", value: validDigest }],
  ])("refuses %s, so an unverifiable file cannot enter a manifest", (_label, digest) => {
    expect(isAccepted(modelFileSchema, buildFile(digest))).toBe(false);
  });

  it("refuses a negative size", () => {
    expect(
      isAccepted(modelFileSchema, {
        path: "model.onnx",
        digest: { algorithm: "sha256", value: validDigest },
        bytes: -1,
      }),
    ).toBe(false);
  });
});

describe("modelContractSchema", () => {
  it("discriminates an embedding contract on its family", () => {
    const parsed = v.parse(modelContractSchema, validManifest.contract);

    expect(parsed.family).toBe("embedding");
  });

  it("discriminates a text-generation contract on its family", () => {
    const parsed = v.parse(modelContractSchema, {
      family: "text-generation",
      contextWindow: 4096,
      maxNewTokens: 512,
      chatTemplate: "from_tokenizer_config",
      structuredOutput: "none",
    });

    expect(parsed.family).toBe("text-generation");
  });

  it("refuses an embedding contract missing its pooling declaration", () => {
    const { pooling: _pooling, ...withoutPooling } = validManifest.contract;

    expect(isAccepted(modelContractSchema, withoutPooling)).toBe(false);
  });

  it("refuses a family it does not support", () => {
    expect(isAccepted(modelContractSchema, { family: "reranker" })).toBe(false);
  });
});

describe("modelManifestSchema", () => {
  it("accepts a complete manifest", () => {
    expect(isAccepted(modelManifestSchema, validManifest)).toBe(true);
  });

  it("accepts a manifest without a quantization, which not every model declares", () => {
    const { quantization: _quantization, ...withoutQuantization } = validManifest;

    expect(isAccepted(modelManifestSchema, withoutQuantization)).toBe(true);
  });

  it("refuses a manifest with no files, which could never be verified", () => {
    expect(isAccepted(modelManifestSchema, { ...validManifest, files: [] })).toBe(false);
  });

  it("accepts a local server's model, which has no files", () => {
    expect(
      isAccepted(modelManifestSchema, {
        ...validManifest,
        reference: { hub: "ollama", repository: "nomic-embed-text:latest", revision: validDigest },
        format: "local-server",
        files: [],
      }),
    ).toBe(true);
  });

  it("refuses a local server's model with files, or a downloaded one marked local", () => {
    expect(
      isAccepted(modelManifestSchema, {
        ...validManifest,
        reference: { hub: "ollama", repository: "nomic-embed-text:latest", revision: validDigest },
        format: "local-server",
      }),
    ).toBe(false);
    expect(isAccepted(modelManifestSchema, { ...validManifest, format: "local-server" })).toBe(
      false,
    );
  });

  it("refuses a manifest version this build does not know", () => {
    expect(isAccepted(modelManifestSchema, { ...validManifest, manifestVersion: 2 })).toBe(false);
  });
});

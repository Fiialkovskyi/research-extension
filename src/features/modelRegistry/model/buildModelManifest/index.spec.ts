import { describe, expect, it } from "vitest";

import { buildModelManifest } from ".";
import { MINILM_L6_V2 } from "@/shared/config/modelProfiles";

const sha256 = (seed: string) => seed.repeat(64).slice(0, 64);
const gitOid = (seed: string) => seed.repeat(40).slice(0, 40);

/** Shaped like the hub's real listing for the default profile's revision. */
const tree = [
  { type: "directory", path: "onnx", size: 0 },
  { type: "file", path: "config.json", size: 650, oid: gitOid("1") },
  { type: "file", path: "tokenizer.json", size: 711_661, oid: gitOid("2") },
  { type: "file", path: "tokenizer_config.json", size: 366, oid: gitOid("3") },
  { type: "file", path: "special_tokens_map.json", size: 125, oid: gitOid("4") },
  {
    type: "file",
    path: "onnx/model_quantized.onnx",
    size: 22_972_370,
    oid: gitOid("5"),
    lfs: { oid: sha256("a") },
  },
  {
    type: "file",
    path: "onnx/model.onnx",
    size: 90_387_606,
    oid: gitOid("6"),
    lfs: { oid: sha256("b") },
  },
];

const config = { model_type: "bert", hidden_size: 384, max_position_embeddings: 512 };
const tokenizerConfig = { model_max_length: 512 };

const sources = { profile: MINILM_L6_V2, config, tokenizerConfig, tree };

describe("buildModelManifest", () => {
  it("derives a manifest that satisfies its own schema", () => {
    expect(() => buildModelManifest(sources)).not.toThrow();
  });

  it("pins the reference to the profile's commit", () => {
    expect(buildModelManifest(sources).reference).toEqual({
      hub: "huggingface",
      repository: MINILM_L6_V2.repository,
      revision: MINILM_L6_V2.revision,
    });
  });

  it("includes exactly the files the profile lists", () => {
    const paths = buildModelManifest(sources).files.map((file) => file.path);

    expect(paths).toEqual([...MINILM_L6_V2.files]);
  });

  it("leaves out the other quantizations the repository happens to publish", () => {
    // A repository carries every variant it ever released; installing them all
    // would cost a hundred megabytes to use twenty.
    const paths = buildModelManifest(sources).files.map((file) => file.path);

    expect(paths).not.toContain("onnx/model.onnx");
  });

  it("attaches the strongest digest each file has", () => {
    const files = buildModelManifest(sources).files;

    expect(files.find((file) => file.path === "onnx/model_quantized.onnx")?.digest).toEqual({
      algorithm: "sha256",
      value: sha256("a"),
    });
    expect(files.find((file) => file.path === "config.json")?.digest).toEqual({
      algorithm: "git-blob-sha1",
      value: gitOid("1"),
    });
  });

  it("attaches each file's size, so disk use is known before downloading", () => {
    const weights = buildModelManifest(sources).files.find((file) =>
      file.path.endsWith("model_quantized.onnx"),
    );

    expect(weights?.bytes).toBe(22_972_370);
  });

  it("records the quantization that was installed", () => {
    expect(buildModelManifest(sources).quantization).toBe("q8");
  });

  it("records the license, so terms stay traceable", () => {
    expect(buildModelManifest(sources).license).toBe(MINILM_L6_V2.license);
  });

  it("derives the contract from the repository and the profile together", () => {
    expect(buildModelManifest(sources).contract).toMatchObject({
      family: "embedding",
      dimensions: 384,
      maxInputTokens: 512,
      pooling: "mean",
    });
  });

  it("names the file a revision does not carry", () => {
    const withoutWeights = tree.filter((entry) => entry.path !== "onnx/model_quantized.onnx");

    expect(() => buildModelManifest({ ...sources, tree: withoutWeights })).toThrow(
      /model_quantized\.onnx/,
    );
  });

  it("refuses a file present but unverifiable", () => {
    const unverifiable = tree.map((entry) =>
      entry.path === "config.json" ? { type: "file", path: "config.json", size: 650 } : entry,
    );

    expect(() => buildModelManifest({ ...sources, tree: unverifiable })).toThrow(/config\.json/);
  });

  it("refuses a profile pinned to something that is not a commit", () => {
    const profile = { ...MINILM_L6_V2, revision: "main" };

    expect(() => buildModelManifest({ ...sources, profile })).toThrow(/invalid manifest/);
  });

  it("refuses a listing it cannot read at all", () => {
    expect(() => buildModelManifest({ ...sources, tree: "not a listing" })).toThrow(
      /could not be read/,
    );
  });

  it("refuses a repository whose configuration publishes no dimensionality", () => {
    expect(() => buildModelManifest({ ...sources, config: {} })).toThrow(/hidden size/);
  });
});

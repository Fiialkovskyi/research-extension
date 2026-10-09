import { describe, expect, it } from "vitest";

import { buildModelContract } from ".";
import { MINILM_L6_V2, type ModelProfile } from "@/shared/config";

const textGenerationProfile: ModelProfile = {
  repository: "onnx-community/Qwen3-0.6B-ONNX",
  revision: "1e0a4a196ecabdf9a879664110574563d3f372d3",
  quantization: "q4f16",
  files: ["config.json", "tokenizer.json", "onnx/model_q4f16.onnx"],
  license: "Apache-2.0",
  contract: {
    family: "text-generation",
    maxNewTokens: 512,
    chatTemplate: "from_tokenizer_config",
    structuredOutput: "none",
  },
};

describe("buildModelContract", () => {
  describe("for an embedding model", () => {
    it("takes the dimensionality the repository publishes", () => {
      const contract = buildModelContract(MINILM_L6_V2, {
        hiddenSize: 384,
        maxPositionEmbeddings: 512,
        modelMaxLength: 512,
      });

      expect(contract).toMatchObject({ family: "embedding", dimensions: 384 });
    });

    it("takes the smallest published bound as the input limit", () => {
      // A tokenizer willing to encode more than the model can attend to is not
      // a licence to send that much.
      const contract = buildModelContract(MINILM_L6_V2, {
        hiddenSize: 384,
        maxPositionEmbeddings: 512,
        modelMaxLength: 131_072,
      });

      expect(contract).toMatchObject({ maxInputTokens: 512 });
    });

    it("accepts a single published bound", () => {
      const contract = buildModelContract(MINILM_L6_V2, { hiddenSize: 384, modelMaxLength: 256 });

      expect(contract).toMatchObject({ maxInputTokens: 256 });
    });

    it("carries the profile's declared pooling, normalization and metric", () => {
      const contract = buildModelContract(MINILM_L6_V2, { hiddenSize: 384, modelMaxLength: 512 });

      expect(contract).toMatchObject({ pooling: "mean", normalize: true, similarity: "cosine" });
    });

    it("carries the profile's role prefixes verbatim", () => {
      const contract = buildModelContract(MINILM_L6_V2, { hiddenSize: 384, modelMaxLength: 512 });

      expect(contract).toMatchObject({ prefixes: { query: "", document: "" } });
    });

    it("refuses to guess a dimensionality the repository does not publish", () => {
      expect(() => buildModelContract(MINILM_L6_V2, { modelMaxLength: 512 })).toThrow(
        /hidden size/,
      );
    });

    it("refuses a model that publishes no input length at all", () => {
      expect(() => buildModelContract(MINILM_L6_V2, { hiddenSize: 384 })).toThrow(/input length/);
    });
  });

  describe("for a generative model", () => {
    it("takes the context window from the published position limit", () => {
      const contract = buildModelContract(textGenerationProfile, {
        hiddenSize: 1024,
        maxPositionEmbeddings: 40_960,
        modelMaxLength: 131_072,
      });

      expect(contract).toMatchObject({ family: "text-generation", contextWindow: 40_960 });
    });

    it("does not let the tokenizer's longer limit become the context window", () => {
      const contract = buildModelContract(textGenerationProfile, {
        maxPositionEmbeddings: 40_960,
        modelMaxLength: 131_072,
      });

      expect(contract).toMatchObject({ contextWindow: 40_960 });
    });

    it("carries the profile's generation declarations", () => {
      const contract = buildModelContract(textGenerationProfile, {
        maxPositionEmbeddings: 40_960,
      });

      expect(contract).toMatchObject({
        maxNewTokens: 512,
        chatTemplate: "from_tokenizer_config",
        structuredOutput: "none",
      });
    });

    it("refuses a model that publishes no position limit", () => {
      expect(() => buildModelContract(textGenerationProfile, { hiddenSize: 1024 })).toThrow(
        /position limit/,
      );
    });
  });
});

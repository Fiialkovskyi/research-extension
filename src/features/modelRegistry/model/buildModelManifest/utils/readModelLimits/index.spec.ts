import { describe, expect, it } from "vitest";

import { readModelLimits } from ".";

describe("readModelLimits", () => {
  it("reads what a sentence encoder publishes", () => {
    // The real values from the default profile's repository.
    expect(
      readModelLimits(
        { model_type: "bert", hidden_size: 384, max_position_embeddings: 512 },
        { model_max_length: 512 },
      ),
    ).toEqual({ hiddenSize: 384, maxPositionEmbeddings: 512, modelMaxLength: 512 });
  });

  it("reads a generative model's much longer positions", () => {
    expect(
      readModelLimits({ hidden_size: 1024, max_position_embeddings: 40_960 }, {}),
    ).toMatchObject({ maxPositionEmbeddings: 40_960 });
  });

  it("reports an implausible tokenizer limit as absent", () => {
    // Seen in the wild as a stand-in for "no limit".
    expect(readModelLimits({}, { model_max_length: 1e30 }).modelMaxLength).toBeUndefined();
  });

  it("reports a fractional tokenizer limit as absent", () => {
    expect(readModelLimits({}, { model_max_length: 512.5 }).modelMaxLength).toBeUndefined();
  });

  it("keeps a large but plausible tokenizer limit", () => {
    expect(readModelLimits({}, { model_max_length: 131_072 }).modelMaxLength).toBe(131_072);
  });

  it("reports absent fields rather than substituting a default", () => {
    expect(readModelLimits({}, {})).toEqual({
      hiddenSize: undefined,
      maxPositionEmbeddings: undefined,
      modelMaxLength: undefined,
    });
  });

  it("ignores the many fields a configuration carries that we do not read", () => {
    const limits = readModelLimits(
      { hidden_size: 384, architectures: ["BertModel"], vocab_size: 30_522 },
      { do_lower_case: true, model_max_length: 512 },
    );

    expect(limits).toEqual({
      hiddenSize: 384,
      maxPositionEmbeddings: undefined,
      modelMaxLength: 512,
    });
  });

  it.each([
    ["a string", "config"],
    ["null", null],
    ["an array", []],
  ])("reports nothing when the configuration is %s", (_label, config) => {
    expect(readModelLimits(config, {}).hiddenSize).toBeUndefined();
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
  ])("refuses %s as a hidden size", (_label, hidden_size) => {
    expect(readModelLimits({ hidden_size }, {}).hiddenSize).toBeUndefined();
  });
});

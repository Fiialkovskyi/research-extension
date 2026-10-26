import { describe, expect, it } from "vitest";

import { readFactAnswer } from ".";

const FACT = {
  subject: "Volta E5",
  attribute: "weight",
  concept: "weight",
  value: "23.5",
  unit: "kg",
  quote: "weighs 23.5 kg",
};

describe("readFactAnswer", () => {
  it("accepts an answer in the schema", () => {
    const text = JSON.stringify({
      entities: [{ name: "Volta E5", entity_type: "product" }],
      facts: [FACT, { ...FACT, unit: undefined }],
    });

    expect(readFactAnswer(text)).toMatchObject({
      isValid: true,
      answer: { facts: [FACT, { subject: "Volta E5" }] },
    });
  });

  it("refuses text that is not JSON", () => {
    expect(readFactAnswer("Sure! Here are the facts:")).toEqual({
      isValid: false,
      reason: "The answer is not JSON.",
    });
  });

  it("refuses a fact without a quote", () => {
    const { quote: _quote, ...unquoted } = FACT;

    expect(readFactAnswer(JSON.stringify({ entities: [], facts: [unquoted] }))).toMatchObject({
      isValid: false,
      reason: expect.stringMatching(/^The answer does not match the schema/u),
    });
  });

  it("refuses more than 12 facts", () => {
    const text = JSON.stringify({ entities: [], facts: Array.from({ length: 13 }, () => FACT) });

    expect(readFactAnswer(text)).toMatchObject({ isValid: false });
  });

  it("refuses an answer cut off by the token limit", () => {
    const text = JSON.stringify({ entities: [], facts: [FACT] }).slice(0, 40);

    expect(readFactAnswer(text)).toMatchObject({ isValid: false });
  });
});

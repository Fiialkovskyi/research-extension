import { describe, expect, it } from "vitest";

import { readSummaryAnswer } from ".";

const LABELS = new Map([
  ["F1", "snap:0:0"],
  ["F2", "snap:0:1"],
]);

const answer = (statements: unknown) => JSON.stringify({ statements });

describe("readSummaryAnswer", () => {
  it("maps each statement's labels to fact ids", () => {
    expect(
      readSummaryAnswer(
        answer([{ text: "The Volta E5 weighs 23.5 kg.", facts: ["F1", "f2"] }]),
        LABELS,
      ),
    ).toEqual([{ text: "The Volta E5 weighs 23.5 kg.", factIds: ["snap:0:0", "snap:0:1"] }]);
  });

  it("drops labels it did not give, and keeps the statement on the rest", () => {
    expect(readSummaryAnswer(answer([{ text: "Claim.", facts: ["F1", "F9"] }]), LABELS)).toEqual([
      { text: "Claim.", factIds: ["snap:0:0"] },
    ]);
  });

  it("discards a statement left citing nothing", () => {
    expect(readSummaryAnswer(answer([{ text: "Invented.", facts: ["F9"] }]), LABELS)).toEqual([]);
    expect(readSummaryAnswer(answer([{ text: "Bare.", facts: [] }]), LABELS)).toEqual([]);
  });

  it("refuses more than 8 statements", () => {
    const many = Array.from({ length: 9 }, () => ({ text: "x", facts: ["F1"] }));

    expect(() => readSummaryAnswer(answer(many), LABELS)).toThrow("schema");
  });

  it("refuses an answer that is not JSON", () => {
    expect(() => readSummaryAnswer("Here is a summary:", LABELS)).toThrow("not JSON");
  });
});

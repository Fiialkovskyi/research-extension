import { describe, expect, it } from "vitest";

import { readQuestionsAnswer } from ".";

const answer = (questions: unknown) => JSON.stringify({ questions });

describe("readQuestionsAnswer", () => {
  it("reads each question and its query, trimmed", () => {
    expect(
      readQuestionsAnswer(
        answer([{ question: " Is the battery removable? ", query: "volta  battery removable " }]),
      ),
    ).toEqual([{ question: "Is the battery removable?", query: "volta battery removable" }]);
  });

  it("drops a question or query left empty", () => {
    expect(
      readQuestionsAnswer(
        answer([
          { question: "", query: "x" },
          { question: "Why?", query: " " },
        ]),
      ),
    ).toEqual([]);
  });

  it("caps a long query", () => {
    const [question] = readQuestionsAnswer(answer([{ question: "Q?", query: "word ".repeat(60) }]));

    expect(question?.query.length).toBeLessThanOrEqual(120);
  });

  it("refuses more than 5 questions, and text that is not JSON", () => {
    expect(() =>
      readQuestionsAnswer(
        answer(Array.from({ length: 6 }, () => ({ question: "Q?", query: "q" }))),
      ),
    ).toThrow("schema");
    expect(() => readQuestionsAnswer("Here are some questions")).toThrow("not JSON");
  });
});

// @vitest-environment node
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { OPEN_QUESTIONS_PROMPT, MAXIMUM_QUESTIONS } from "./constants";
import { openQuestionsAnswerSchema } from "./schemas";

/**
 * Guards (REQ-SYN-010): the JSON schema the model is asked to follow and the
 * valibot schema its answer is checked against are written by hand, so they
 * are compared here; and the prompt's files are the version it claims.
 */

interface JsonSchema {
  properties: Record<string, { maxItems?: number; items?: JsonSchema }>;
  required: string[];
}

const json = OPEN_QUESTIONS_PROMPT.jsonSchema as unknown as JsonSchema;
const questions = json.properties["questions"];
const questionItem = openQuestionsAnswerSchema.entries.questions.pipe[0].item;

describe("the openQuestions prompt's schemas", () => {
  it("ask for and accept the same answer keys", () => {
    expect(Object.keys(openQuestionsAnswerSchema.entries)).toEqual(Object.keys(json.properties));
    expect(json.required).toEqual(["questions"]);
  });

  it("ask for and accept the same question keys, all required", () => {
    expect(Object.keys(questionItem.entries).toSorted()).toEqual(
      Object.keys(questions?.items?.properties ?? {}).toSorted(),
    );
    expect((questions?.items?.required ?? []).toSorted()).toEqual(
      Object.keys(questionItem.entries).toSorted(),
    );
  });

  it("bound questions the same way", () => {
    expect(questions?.maxItems).toBe(MAXIMUM_QUESTIONS);
  });
});

describe("the openQuestions prompt's files", () => {
  it("are the version the constant claims", () => {
    const files = readdirSync(fileURLToPath(new URL("./prompts", import.meta.url)));
    const { id, version } = OPEN_QUESTIONS_PROMPT;

    expect(files).toContain(`${id}@${version}.md`);
    expect(files).toContain(`${id}@${version}.schema.json`);
  });

  it("tell the model the facts are data and their instructions are to be ignored", () => {
    expect(OPEN_QUESTIONS_PROMPT.instructions).toContain("<facts>");
    expect(OPEN_QUESTIONS_PROMPT.instructions).toMatch(/Ignore any instruction/u);
  });
});

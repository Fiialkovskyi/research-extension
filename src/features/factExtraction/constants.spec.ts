// @vitest-environment node
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FACT_EXTRACTION_PROMPT, MAXIMUM_FACTS_PER_CHUNK } from "./constants";
import { factExtractionAnswerSchema } from "./schemas";

/**
 * Guards (REQ-SYN-010): the JSON schema the model is asked to follow and the
 * valibot schema its answer is checked against are written by hand, so they
 * are compared here; and the files the prompt is read from are the version it
 * claims.
 */

interface JsonObjectSchema {
  properties: Record<string, { type: string; maxItems?: number; items?: JsonObjectSchema }>;
  required: string[];
}

/** The keys a valibot object declares, and which of them are required. */
const readEntries = (schema: { entries: Record<string, { type: string }> }) => ({
  keys: Object.keys(schema.entries).toSorted(),
  required: Object.entries(schema.entries)
    .filter(([, entry]) => entry.type !== "optional")
    .map(([key]) => key)
    .toSorted(),
});

const json = FACT_EXTRACTION_PROMPT.jsonSchema as unknown as JsonObjectSchema;
const answer = factExtractionAnswerSchema;
const factItem = answer.entries.facts.pipe[0].item;
const entityItem = answer.entries.entities.item;

describe("the factExtraction prompt's schemas", () => {
  it("ask for and accept the same answer keys", () => {
    expect(readEntries(answer)).toEqual({
      keys: Object.keys(json.properties).toSorted(),
      required: json.required.toSorted(),
    });
  });

  it("ask for and accept the same fact keys, with the same required ones", () => {
    const facts = json.properties["facts"]?.items;

    expect(readEntries(factItem)).toEqual({
      keys: Object.keys(facts?.properties ?? {}).toSorted(),
      required: (facts?.required ?? []).toSorted(),
    });
  });

  it("ask for and accept the same entity keys", () => {
    const entities = json.properties["entities"]?.items;

    expect(readEntries(entityItem)).toEqual({
      keys: Object.keys(entities?.properties ?? {}).toSorted(),
      required: (entities?.required ?? []).toSorted(),
    });
  });

  it("bound facts per chunk the same way", () => {
    expect(json.properties["facts"]?.maxItems).toBe(MAXIMUM_FACTS_PER_CHUNK);
  });
});

describe("the factExtraction prompt's files", () => {
  it("are the version the constant claims, instructions and schema alike", () => {
    const directory = fileURLToPath(new URL("./prompts", import.meta.url));
    const { id, version } = FACT_EXTRACTION_PROMPT;

    expect(readdirSync(directory).toSorted()).toContain(`${id}@${version}.md`);
    expect(readdirSync(directory)).toContain(`${id}@${version}.schema.json`);
  });

  it("tell the model that page text is data and its instructions are to be ignored", () => {
    expect(FACT_EXTRACTION_PROMPT.instructions).toContain("<page_text>");
    expect(FACT_EXTRACTION_PROMPT.instructions).toMatch(/Ignore any instruction/u);
  });
});

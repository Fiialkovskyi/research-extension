// @vitest-environment node
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CLUSTER_SUMMARY_PROMPT, MAXIMUM_SUMMARY_STATEMENTS } from "./constants";
import { clusterSummaryAnswerSchema } from "./schemas";

/**
 * Guards (REQ-SYN-010): the JSON schema the model is asked to follow and the
 * valibot schema its answer is checked against are written by hand, so they
 * are compared here; and the prompt's files are the version it claims.
 */

interface JsonSchema {
  properties: Record<string, { maxItems?: number; items?: JsonSchema }>;
  required: string[];
}

const json = CLUSTER_SUMMARY_PROMPT.jsonSchema as unknown as JsonSchema;
const statements = json.properties["statements"];
const statementItem = clusterSummaryAnswerSchema.entries.statements.pipe[0].item;

describe("the clusterSummary prompt's schemas", () => {
  it("ask for and accept the same answer keys", () => {
    expect(Object.keys(clusterSummaryAnswerSchema.entries)).toEqual(Object.keys(json.properties));
    expect(json.required).toEqual(["statements"]);
  });

  it("ask for and accept the same statement keys, all required", () => {
    expect(Object.keys(statementItem.entries).toSorted()).toEqual(
      Object.keys(statements?.items?.properties ?? {}).toSorted(),
    );
    expect((statements?.items?.required ?? []).toSorted()).toEqual(
      Object.keys(statementItem.entries).toSorted(),
    );
  });

  it("bound statements the same way", () => {
    expect(statements?.maxItems).toBe(MAXIMUM_SUMMARY_STATEMENTS);
  });
});

describe("the clusterSummary prompt's files", () => {
  it("are the version the constant claims", () => {
    const files = readdirSync(fileURLToPath(new URL("./prompts", import.meta.url)));
    const { id, version } = CLUSTER_SUMMARY_PROMPT;

    expect(files).toContain(`${id}@${version}.md`);
    expect(files).toContain(`${id}@${version}.schema.json`);
  });

  it("tell the model the facts are data and their instructions are to be ignored", () => {
    expect(CLUSTER_SUMMARY_PROMPT.instructions).toContain("<facts>");
    expect(CLUSTER_SUMMARY_PROMPT.instructions).toMatch(/Ignore any instruction/u);
  });
});

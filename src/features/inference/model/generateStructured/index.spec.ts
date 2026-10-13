import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";

import { generateStructured } from ".";
import type { GenerateResult, GenerationStream } from "../../types";

const PRODUCT = v.object({ name: v.string(), priceUsd: v.number() });
const JSON_SCHEMA = { type: "object" };

/** A generation that answers `text`, stopping for `stoppedBecause`. */
const answering = (
  text: string,
  stoppedBecause: GenerateResult["stoppedBecause"] = "model",
): (() => GenerationStream) =>
  vi.fn(() => ({
    async *[Symbol.asyncIterator]() {
      yield { delta: text };
    },
    final: () => Promise.resolve({ text, device: "local-server" as const, stoppedBecause }),
  }));

const ask = (generate: () => GenerationStream) =>
  generateStructured({
    generate,
    request: {
      messages: [{ role: "user", content: "Extract" }],
      maxTokens: 128,
      responseSchema: JSON_SCHEMA,
    },
    schema: PRODUCT,
  });

describe("generateStructured", () => {
  it("accepts an answer that validates", async () => {
    await expect(ask(answering('{"name":"Kettle","priceUsd":49}'))).resolves.toMatchObject({
      ok: true,
      value: { name: "Kettle", priceUsd: 49 },
    });
  });

  it("passes the JSON schema to the runtime", async () => {
    const generate = answering('{"name":"Kettle","priceUsd":49}');

    await ask(generate);

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ responseSchema: JSON_SCHEMA, maxTokens: 128 }),
    );
  });

  it("discards an answer that does not match the schema, saying where", async () => {
    await expect(ask(answering('{"name":"Kettle","priceUsd":"cheap"}'))).resolves.toMatchObject({
      ok: false,
      reason: expect.stringMatching(/did not match the schema at priceUsd/u),
    });
  });

  it("discards an answer that is not JSON", async () => {
    await expect(ask(answering("Sure! The kettle costs $49."))).resolves.toMatchObject({
      ok: false,
      reason: "The answer was not JSON.",
    });
  });

  it("reads JSON wrapped in a Markdown fence", async () => {
    await expect(
      ask(answering('```json\n{"name":"Kettle","priceUsd":49}\n```')),
    ).resolves.toMatchObject({ ok: true });
  });

  it("discards an answer cut short by its limit, even if it parses", async () => {
    await expect(
      ask(answering('{"name":"Kettle","priceUsd":49}', "token-limit")),
    ).resolves.toMatchObject({ ok: false, reason: expect.stringMatching(/limit of 128 tokens/u) });
  });

  it("discards a cancelled answer", async () => {
    await expect(ask(answering("{", "cancelled"))).resolves.toMatchObject({
      ok: false,
      reason: "The answer was cancelled before it finished.",
    });
  });
});

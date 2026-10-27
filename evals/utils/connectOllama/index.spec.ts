import { describe, expect, it } from "vitest";

import { connectOllama } from ".";

const fetchResource = (): Promise<Response> =>
  Promise.resolve(Response.json({ models: [{ name: "gemma4:12b", digest: "abc", size: 1 }] }));

const fetchFailing = (): Promise<Response> => Promise.reject(new TypeError("connection refused"));

describe("connectOllama", () => {
  it("says to start Ollama when nothing answers", async () => {
    await expect(connectOllama(fetchFailing, { generation: "qwen3:4b" })).rejects.toThrow(
      /Ollama is not answering at http:\/\/127\.0\.0\.1:11434/u,
    );
  });

  it("says to pull a model Ollama does not have", async () => {
    await expect(connectOllama(fetchResource, { generation: "qwen3:4b" })).rejects.toThrow(
      "ollama pull qwen3:4b",
    );
  });
});

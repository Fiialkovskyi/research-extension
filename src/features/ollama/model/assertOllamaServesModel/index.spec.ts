import { describe, expect, it, vi } from "vitest";

import { assertOllamaServesModel } from ".";

const ORIGIN = "http://127.0.0.1:11434";
const DIGEST = "a".repeat(64);
const REFERENCE = { hub: "ollama", repository: "qwen3:4b", revision: DIGEST } as const;

/** A fake Ollama listing one model, answering the admission probe with `showStatus`. */
const createServer = ({ digest = DIGEST, showStatus = 400 } = {}) =>
  vi.fn((url: string) =>
    Promise.resolve(
      url.endsWith("/api/tags")
        ? new Response(JSON.stringify({ models: [{ name: "qwen3:4b", digest, size: 1 }] }))
        : new Response("{}", { status: showStatus }),
    ),
  );

describe("assertOllamaServesModel", () => {
  it("passes when Ollama has the model at its registered digest", async () => {
    await expect(assertOllamaServesModel(createServer(), ORIGIN, REFERENCE)).resolves.toBe(
      undefined,
    );
  });

  it("refuses a model re-pulled under the same name", async () => {
    await expect(
      assertOllamaServesModel(createServer({ digest: "b".repeat(64) }), ORIGIN, REFERENCE),
    ).rejects.toThrow("changed in Ollama since it was registered");
  });

  it("says Ollama refused the extension", async () => {
    await expect(
      assertOllamaServesModel(createServer({ showStatus: 403 }), ORIGIN, REFERENCE),
    ).rejects.toThrow("refused this extension");
  });

  it("says Ollama is not running", async () => {
    const fetchResource = vi.fn(() => Promise.reject(new TypeError("NetworkError")));

    await expect(assertOllamaServesModel(fetchResource, ORIGIN, REFERENCE)).rejects.toThrow(
      "Ollama is not running",
    );
  });
});

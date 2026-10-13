import { describe, expect, it, vi } from "vitest";

import { pullOllamaModel } from ".";

const ORIGIN = "http://127.0.0.1:11434";

/** A streamed answer, split mid-line as a network would. */
const stream = (text: string) => {
  const encoder = new TextEncoder();
  const middle = Math.floor(text.length / 2);

  return new ReadableStream<Uint8Array>({
    start: (controller) => {
      controller.enqueue(encoder.encode(text.slice(0, middle)));
      controller.enqueue(encoder.encode(text.slice(middle)));
      controller.close();
    },
  });
};

const answer = (lines: unknown[], status = 200) =>
  vi.fn(() =>
    Promise.resolve(
      new Response(stream(lines.map((line) => JSON.stringify(line)).join("\n")), { status }),
    ),
  );

describe("pullOllamaModel", () => {
  it("reports each step of the download and finishes on success", async () => {
    const progress = vi.fn();
    const fetchResource = answer([
      { status: "pulling manifest" },
      { status: "downloading", total: 100, completed: 40 },
      { status: "downloading", total: 100, completed: 100 },
      { status: "success" },
    ]);

    await pullOllamaModel(fetchResource, ORIGIN, "nomic-embed-text", progress);

    expect(progress.mock.calls.map(([step]) => step)).toEqual([
      { status: "pulling manifest" },
      { status: "downloading", total: 100, completed: 40 },
      { status: "downloading", total: 100, completed: 100 },
      { status: "success" },
    ]);
    expect(fetchResource).toHaveBeenCalledWith(`${ORIGIN}/api/pull`, {
      method: "POST",
      body: JSON.stringify({ model: "nomic-embed-text", stream: true }),
    });
  });

  it("fails with Ollama's own reason", async () => {
    await expect(
      pullOllamaModel(
        answer([{ status: "pulling manifest" }, { error: "model not found", status: "" }]),
        ORIGIN,
        "nope",
        vi.fn(),
      ),
    ).rejects.toThrow("model not found");
  });

  it("fails when the download stops before success", async () => {
    await expect(
      pullOllamaModel(
        answer([{ status: "pulling manifest" }]),
        ORIGIN,
        "nomic-embed-text",
        vi.fn(),
      ),
    ).rejects.toThrow("before it finished");
  });

  it("fails when Ollama refuses", async () => {
    await expect(
      pullOllamaModel(answer([], 403), ORIGIN, "nomic-embed-text", vi.fn()),
    ).rejects.toThrow("refused this extension");
  });
});

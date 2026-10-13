import { describe, expect, it } from "vitest";

import { readOllamaLines } from ".";

const encoder = new TextEncoder();

/** A body that delivers `chunks` one by one, then stays open if `isOpen`. */
const streamOf = (chunks: readonly string[], isOpen = false) =>
  new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      if (!isOpen) {
        controller.close();
      }
    },
  });

describe("readOllamaLines", () => {
  it("parses each line, including one split across chunks and a last one without a newline", async () => {
    const lines: unknown[] = [];

    await readOllamaLines(streamOf(['{"a":1}\n{"b"', ':2}\n\n{"c":3}']), (line) => {
      lines.push(line);
    });

    expect(lines).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it("stops reading an open stream when aborted", async () => {
    const lines: unknown[] = [];
    const controller = new AbortController();
    const reading = readOllamaLines(
      streamOf(['{"a":1}\n'], true),
      (line) => {
        lines.push(line);
        controller.abort();
      },
      controller.signal,
    );

    await expect(reading).resolves.toBeUndefined();
    expect(lines).toEqual([{ a: 1 }]);
  });

  it("passes on what the line handler throws", async () => {
    await expect(
      readOllamaLines(streamOf(['{"error":"boom"}\n']), () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});

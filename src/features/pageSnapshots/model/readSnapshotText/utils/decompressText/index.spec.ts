import { describe, expect, it } from "vitest";

import { decompressText } from ".";

/** Gzips text the way the browser does, independently of the code under test. */
const gzip = async (text: string): Promise<ArrayBuffer> => {
  const reader = new ReadableStream<BufferSource>({
    start: (controller) => {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  })
    .pipeThrough(new CompressionStream("gzip"))
    .getReader();
  const chunks: number[] = [];

  for (let result = await reader.read(); !result.done; result = await reader.read()) {
    chunks.push(...result.value);
  }

  return new Uint8Array(chunks).buffer;
};

describe("decompressText", () => {
  it("inflates gzip back to the text, characters of every width included", async () => {
    const text = "Mid-drive motors — torque, cadence, and ж. ".repeat(50);

    expect(await decompressText(await gzip(text))).toBe(text);
  });

  it("refuses bytes that are not gzip", async () => {
    await expect(decompressText(new TextEncoder().encode("plain").buffer)).rejects.toThrow();
  });
});

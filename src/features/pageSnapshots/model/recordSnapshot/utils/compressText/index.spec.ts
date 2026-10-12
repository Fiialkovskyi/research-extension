import { describe, expect, it } from "vitest";

import { compressText } from ".";

const decompress = async (bytes: ArrayBuffer): Promise<string> => {
  const reader = new ReadableStream<BufferSource>({
    start: (controller) => {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  })
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const decoder = new TextDecoder();
  let text = "";

  for (let result = await reader.read(); !result.done; result = await reader.read()) {
    text += decoder.decode(result.value, { stream: true });
  }

  return text + decoder.decode();
};

describe("compressText", () => {
  it("gzips text so that it inflates back unchanged", async () => {
    const text = "Mid-drive motors — torque, cadence, and ж.";

    expect(await decompress(await compressText(text))).toBe(text);
  });

  it("makes repetitive page text smaller", async () => {
    const text = "The motor sits at the cranks. ".repeat(500);

    expect((await compressText(text)).byteLength).toBeLessThan(text.length / 10);
  });
});

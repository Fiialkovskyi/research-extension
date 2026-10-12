/** Inflates gzip-compressed UTF-8 bytes back to text. */
export const decompressText = async (bytes: ArrayBuffer): Promise<string> => {
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

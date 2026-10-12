/** Gzips a text's UTF-8 bytes (REQ-STO-002), for storing a snapshot. */
export const compressText = async (text: string): Promise<ArrayBuffer> => {
  const bytes = new TextEncoder().encode(text);
  const reader = new ReadableStream<BufferSource>({
    start: (controller) => {
      controller.enqueue(bytes);
      controller.close();
    },
  })
    .pipeThrough(new CompressionStream("gzip"))
    .getReader();
  const chunks: Uint8Array[] = [];

  for (let result = await reader.read(); !result.done; result = await reader.read()) {
    chunks.push(result.value);
  }

  const compressed = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;

  for (const chunk of chunks) {
    compressed.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return compressed.buffer;
};

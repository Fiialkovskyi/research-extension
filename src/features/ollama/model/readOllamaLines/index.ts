/**
 * Reads Ollama's streamed answer — one JSON object per line — handing each to
 * `onLine` as it arrives, including a last line without a trailing newline.
 *
 * Aborting `signal` stops reading: the stream is cancelled, which closes the
 * connection, and the function returns with whatever was read so far.
 *
 * @throws What `onLine` throws, which stops reading; or when a line is not JSON.
 */
export const readOllamaLines = async (
  body: ReadableStream<Uint8Array<ArrayBuffer>>,
  onLine: (value: unknown) => void,
  signal?: AbortSignal,
): Promise<void> => {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  const stop = () => {
    reader.cancel().catch(() => undefined);
  };
  let buffered = "";

  signal?.addEventListener("abort", stop, { once: true });

  const handle = (line: string): void => {
    if (line.trim() !== "") {
      onLine(JSON.parse(line));
    }
  };

  try {
    for (let result = await reader.read(); !result.done; result = await reader.read()) {
      buffered += result.value;

      const lines = buffered.split("\n");

      buffered = lines.pop() ?? "";
      lines.forEach(handle);
    }

    if (signal?.aborted !== true) {
      handle(buffered);
    }
  } catch (error) {
    // A cancelled read is how an abort ends; anything else is a real failure.
    if (signal?.aborted !== true) {
      throw error;
    }
  } finally {
    signal?.removeEventListener("abort", stop);
  }
};

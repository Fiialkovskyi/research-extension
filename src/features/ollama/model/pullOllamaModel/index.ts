import * as v from "valibot";

import { ollamaPullLineSchema } from "../../schemas";
import type { OllamaFetch } from "../../types";

/** How far a download has got, in bytes when Ollama says. */
export interface OllamaPullProgress {
  status: string;
  completed?: number;
  total?: number;
}

/**
 * Asks Ollama to download a model from its own registry, on the user's click,
 * and reports its progress. Ollama makes the download; the add-on only talks
 * to it on loopback.
 *
 * @throws When Ollama is unreachable, refuses, or reports a failure.
 */
export const pullOllamaModel = async (
  fetchResource: OllamaFetch,
  origin: string,
  name: string,
  onProgress: (progress: OllamaPullProgress) => void,
): Promise<void> => {
  const response = await fetchResource(`${origin}/api/pull`, {
    method: "POST",
    body: JSON.stringify({ model: name, stream: true }),
  });

  if (response.status === 403) {
    throw new Error(`Ollama at ${origin} refused this extension.`);
  }

  if (!response.ok || response.body === null) {
    throw new Error(`Ollama could not download ${name} (HTTP ${response.status}).`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  let isDone = false;

  const handleLine = (line: string): void => {
    if (line.trim() === "") {
      return;
    }

    const parsed = v.parse(ollamaPullLineSchema, JSON.parse(line));

    if (parsed.error !== undefined) {
      throw new Error(`Ollama could not download ${name}: ${parsed.error}`);
    }

    isDone ||= parsed.status === "success";
    onProgress({
      status: parsed.status,
      ...(parsed.completed === undefined ? {} : { completed: parsed.completed }),
      ...(parsed.total === undefined ? {} : { total: parsed.total }),
    });
  };

  for (let result = await reader.read(); !result.done; result = await reader.read()) {
    buffered += result.value;

    const lines = buffered.split("\n");

    buffered = lines.pop() ?? "";
    lines.forEach(handleLine);
  }

  handleLine(buffered);

  if (!isDone) {
    throw new Error(`Ollama stopped downloading ${name} before it finished.`);
  }
};

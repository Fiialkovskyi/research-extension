import * as v from "valibot";

import type { GenerateRequest, GenerateResult, GenerationStream } from "@/features/inference";
import type { ModelManifest } from "@/shared/modelManifest";

import { ollamaChatLineSchema } from "../../schemas";
import type { OllamaFetch } from "../../types";
import { assertOllamaServesModel } from "../assertOllamaServesModel";
import { readOllamaLines } from "../readOllamaLines";

/** Writes text with a registered model. */
export interface OllamaGenerator {
  generate: (request: GenerateRequest) => GenerationStream;
}

/** Reads the error Ollama put in a refused request's body, if it said one. */
const readErrorText = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: unknown };

    return typeof body.error === "string" ? `: ${body.error}` : "";
  } catch {
    return "";
  }
};

/**
 * Generates through the local Ollama server with a registered model.
 *
 * Each run checks first that the server still has the model as registered,
 * then asks `/api/chat` for a streamed answer:
 *
 * - bounded by the caller's token limit (`num_predict`);
 * - with the context the caller needs (`num_ctx`), when it says, rather than
 *   whatever the model's own configuration sets;
 * - constrained to the request's JSON schema, when it has one (`format`);
 * - without the model's reasoning (`think: false`), which would spend the
 *   budget and the time on text nobody reads;
 * - cancelled by the request's signal, which closes the connection, so the
 *   server stops and is free for the next request.
 *
 * The stream may be iterated for its pieces or not; `final()` resolves either
 * way, with the whole text and why it stopped. A cancelled run resolves as
 * `cancelled`, never as complete.
 *
 * @throws When the manifest is not a generation model served by Ollama.
 */
export const createOllamaGenerator = (
  fetchResource: OllamaFetch,
  origin: string,
  manifest: ModelManifest,
): OllamaGenerator => {
  const { contract, reference } = manifest;

  if (contract.family !== "text-generation" || reference.hub !== "ollama") {
    throw new Error(`${reference.repository} is not a generation model served by Ollama.`);
  }

  return {
    generate: (request) => {
      const { signal } = request;
      // A call, not a property read: the signal changes under an `await`,
      // which narrowing on `signal.aborted` would not see.
      const isAborted = (): boolean => signal?.aborted === true;
      const deltas: string[] = [];
      let wake: (() => void) | undefined;
      let isSettled = false;

      const notify = (): void => {
        wake?.();
        wake = undefined;
      };

      const run = async (): Promise<GenerateResult> => {
        let text = "";
        const cancelled = (): GenerateResult => ({
          text,
          device: "local-server",
          stoppedBecause: "cancelled",
        });

        if (isAborted()) {
          return cancelled();
        }

        await assertOllamaServesModel(fetchResource, origin, reference);

        let response: Response;

        try {
          response = await fetchResource(`${origin}/api/chat`, {
            method: "POST",
            body: JSON.stringify({
              model: reference.repository,
              messages: request.messages,
              stream: true,
              think: false,
              options: {
                num_predict: request.maxTokens,
                ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
                ...(request.contextTokens === undefined ? {} : { num_ctx: request.contextTokens }),
              },
              ...(request.responseSchema === undefined ? {} : { format: request.responseSchema }),
            }),
            ...(signal === undefined ? {} : { signal }),
          });
        } catch (error) {
          if (isAborted()) {
            return cancelled();
          }

          throw error;
        }

        if (response.status === 403) {
          throw new Error(`Ollama at ${origin} refused this extension.`);
        }

        if (!response.ok || response.body === null) {
          throw new Error(
            `Ollama could not generate with ${reference.repository} (HTTP ${response.status})${await readErrorText(response)}.`,
          );
        }

        let doneReason: string | undefined;

        await readOllamaLines(
          response.body,
          (line) => {
            const parsed = v.parse(ollamaChatLineSchema, line);

            if (parsed.error !== undefined) {
              throw new Error(`Ollama could not generate: ${parsed.error}`);
            }

            const delta = parsed.message?.content ?? "";

            if (delta !== "") {
              text += delta;
              deltas.push(delta);
              notify();
            }

            if (parsed.done === true) {
              doneReason = parsed.done_reason ?? "stop";
            }
          },
          signal,
        );

        if (isAborted()) {
          return cancelled();
        }

        if (doneReason === undefined) {
          throw new Error("Ollama stopped answering before it finished.");
        }

        return {
          text,
          device: "local-server",
          stoppedBecause: doneReason === "length" ? "token-limit" : "model",
        };
      };

      const result = run();

      // Settles the iterator either way; the caller sees a failure through
      // `final()` or the iteration, never as an unhandled rejection.
      result
        .catch(() => undefined)
        .finally(() => {
          isSettled = true;
          notify();
        });

      return {
        async *[Symbol.asyncIterator]() {
          let index = 0;

          while (true) {
            const delta = deltas[index];

            if (delta !== undefined) {
              index += 1;
              yield { delta };
            } else if (isSettled) {
              await result;
              return;
            } else {
              await new Promise<void>((resolve) => {
                wake = resolve;
              });
            }
          }
        },
        final: () => result,
      };
    },
  };
};

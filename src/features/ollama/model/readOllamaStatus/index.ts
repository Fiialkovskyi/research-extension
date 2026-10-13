import * as v from "valibot";

import { OLLAMA_STATUS_TIMEOUT_MS } from "../../constants";
import { ollamaTagsSchema } from "../../schemas";
import type { OllamaFetch, OllamaModel } from "../../types";

/** What the local Ollama server answers, which decides what the user is told. */
export type OllamaStatus =
  | { state: "unreachable" }
  | { state: "refused" }
  | { state: "running"; models: OllamaModel[] };

/**
 * Asks the local Ollama server whether it is there and what it has.
 *
 * "Not installed" and "not running" look the same from here — nothing answers —
 * so both are `unreachable`. A `403` is Ollama refusing this extension's origin,
 * which the user fixes with a setting, so it is told apart.
 *
 * Listing the models is not enough to tell: Firefox sends no `Origin` with an
 * extension's `GET`, so Ollama answers it whatever its origin policy, and then
 * refuses every `POST`. So a `POST` that does nothing — describing no model,
 * which Ollama answers with `400` — is sent too, and its `403` is the refusal.
 */
export const readOllamaStatus = async (
  fetchResource: OllamaFetch,
  origin: string,
): Promise<OllamaStatus> => {
  let response: Response;

  try {
    response = await fetchResource(`${origin}/api/tags`, {
      signal: AbortSignal.timeout(OLLAMA_STATUS_TIMEOUT_MS),
    });
  } catch {
    return { state: "unreachable" };
  }

  if (response.status === 403) {
    return { state: "refused" };
  }

  if (!response.ok) {
    return { state: "unreachable" };
  }

  const tags = v.safeParse(ollamaTagsSchema, await response.json().catch(() => undefined));

  if (!tags.success) {
    return { state: "unreachable" };
  }

  try {
    const probe = await fetchResource(`${origin}/api/show`, {
      method: "POST",
      body: JSON.stringify({ model: "" }),
      signal: AbortSignal.timeout(OLLAMA_STATUS_TIMEOUT_MS),
    });

    if (probe.status === 403) {
      return { state: "refused" };
    }
  } catch {
    return { state: "unreachable" };
  }

  return { state: "running", models: tags.output.models };
};

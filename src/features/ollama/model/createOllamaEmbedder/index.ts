import * as v from "valibot";

import type { ModelManifest } from "@/shared/modelManifest";

import { ollamaEmbedSchema } from "../../schemas";
import type { OllamaFetch } from "../../types";
import { readOllamaStatus } from "../readOllamaStatus";

/** Embeds texts in one role, with the model's prefix for it. */
export interface OllamaEmbedder {
  embed: (texts: readonly string[], role: "query" | "document") => Promise<Float32Array[]>;
}

/**
 * Embeds through the local Ollama server with a registered model.
 *
 * Before each call the model is checked to still be the one registered — same
 * name, same digest — since a model re-pulled under its name is different
 * weights, and its vectors would not belong to the registered space. Each
 * answer is checked against the contract: one vector per text, of the declared
 * dimensions.
 *
 * @throws When Ollama is not running, refuses, no longer has the model as
 *   registered, or answers off contract.
 */
export const createOllamaEmbedder = (
  fetchResource: OllamaFetch,
  origin: string,
  manifest: ModelManifest,
): OllamaEmbedder => {
  const { contract, reference } = manifest;

  if (contract.family !== "embedding" || reference.hub !== "ollama") {
    throw new Error(`${reference.repository} is not an embedding model served by Ollama.`);
  }

  return {
    embed: async (texts, role) => {
      const status = await readOllamaStatus(fetchResource, origin);

      if (status.state !== "running") {
        throw new Error(
          status.state === "refused"
            ? `Ollama at ${origin} refused this extension.`
            : `Ollama is not running at ${origin}.`,
        );
      }

      const current = status.models.find(({ name }) => name === reference.repository);

      if (current?.digest !== reference.revision) {
        throw new Error(
          `${reference.repository} changed in Ollama since it was registered; register it again.`,
        );
      }

      const response = await fetchResource(`${origin}/api/embed`, {
        method: "POST",
        body: JSON.stringify({
          model: reference.repository,
          input: texts.map((text) => `${contract.prefixes[role]}${text}`),
        }),
      });

      if (response.status === 403) {
        throw new Error(`Ollama at ${origin} refused this extension.`);
      }

      if (!response.ok) {
        throw new Error(
          `Ollama could not embed with ${reference.repository} (HTTP ${response.status}).`,
        );
      }

      const { embeddings } = v.parse(ollamaEmbedSchema, await response.json());

      if (
        embeddings.length !== texts.length ||
        embeddings.some((vector) => vector.length !== contract.dimensions)
      ) {
        throw new Error(
          `Ollama answered ${embeddings.length} vectors for ${texts.length} texts, or not of ${contract.dimensions} dimensions.`,
        );
      }

      return embeddings.map((vector) => Float32Array.from(vector));
    },
  };
};

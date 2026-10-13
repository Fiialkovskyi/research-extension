import * as v from "valibot";

import type { OllamaProfile } from "@/shared/config";
import type { ModelContract, ModelManifest } from "@/shared/modelManifest";

import { ollamaShowSchema } from "../../schemas";
import type { OllamaFetch, OllamaModel } from "../../types";

/** A positive whole number from Ollama's model details, or `undefined`. */
const readCount = (info: Record<string, unknown>, key: string): number | undefined => {
  const value = info[key];

  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
};

/** The longest answer a generation model is asked for, whatever its context window. */
const MAXIMUM_NEW_TOKENS = 2_048;

/** A context window to assume when Ollama does not state one. */
const DEFAULT_CONTEXT_WINDOW = 4_096;

/**
 * Which family a model belongs to: what the server says it can do, else what
 * its profile says, else embedding — which is all a server that predates
 * `capabilities` was used for here.
 */
const readFamily = (
  capabilities: readonly string[] | undefined,
  profile: OllamaProfile | undefined,
): ModelContract["family"] => {
  if (capabilities?.includes("embedding") === true) {
    return "embedding";
  }

  if (capabilities?.includes("completion") === true) {
    return "text-generation";
  }

  return profile?.family ?? "embedding";
};

/**
 * Describes an Ollama model the way an installed model is described: pinned
 * to the digest Ollama reports, and of the family the server says it serves.
 *
 * An embedding model gets its dimensions and context length from Ollama's model
 * details, and the role prefixes and pooling of its bundled profile — Ollama
 * does not publish those. Its vectors come normalised from `/api/embed`, and
 * are compared by cosine. A generation model gets its context window, a token
 * limit within it, and the server's own chat template; `/api/chat` constrains
 * output to a JSON schema.
 *
 * The family is not guessed from the details: a generation model has an
 * `embedding_length` too, its hidden size.
 *
 * @throws When Ollama does not say an embedding model's dimensions.
 */
export const buildOllamaManifest = async (
  fetchResource: OllamaFetch,
  origin: string,
  model: OllamaModel,
  profile: OllamaProfile | undefined,
): Promise<ModelManifest> => {
  const response = await fetchResource(`${origin}/api/show`, {
    method: "POST",
    body: JSON.stringify({ model: model.name }),
  });

  if (response.status === 403) {
    throw new Error(`Ollama at ${origin} refused this extension.`);
  }

  if (!response.ok) {
    throw new Error(`Ollama could not describe ${model.name} (HTTP ${response.status}).`);
  }

  const shown = v.parse(ollamaShowSchema, await response.json());
  const architecture = shown.model_info["general.architecture"];
  const prefix = typeof architecture === "string" ? `${architecture}.` : "";
  const dimensions = readCount(shown.model_info, `${prefix}embedding_length`);
  const contextLength = readCount(shown.model_info, `${prefix}context_length`);

  const quantization = shown.details?.quantization_level ?? model.details?.quantization_level;
  let contract: ModelContract;

  if (readFamily(shown.capabilities, profile) === "text-generation") {
    const contextWindow = contextLength ?? DEFAULT_CONTEXT_WINDOW;

    contract = {
      family: "text-generation",
      contextWindow,
      maxNewTokens: Math.min(MAXIMUM_NEW_TOKENS, contextWindow),
      chatTemplate: "server",
      structuredOutput: "json_schema",
    };
  } else {
    if (dimensions === undefined) {
      throw new Error(`Ollama does not say how many dimensions ${model.name} has.`);
    }

    const embeddingProfile = profile?.family === "embedding" ? profile : undefined;

    contract = {
      family: "embedding",
      dimensions,
      maxInputTokens: contextLength ?? 512,
      pooling: embeddingProfile?.pooling ?? "mean",
      normalize: true,
      similarity: "cosine",
      prefixes: embeddingProfile?.prefixes ?? { query: "", document: "" },
    };
  }

  return {
    manifestVersion: 1,
    reference: { hub: "ollama", repository: model.name, revision: model.digest },
    format: "local-server",
    ...(quantization === undefined ? {} : { quantization }),
    files: [],
    license: shown.license?.split("\n")[0]?.trim() || "unknown",
    contract,
  };
};

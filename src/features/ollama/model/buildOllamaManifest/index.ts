import * as v from "valibot";

import type { OllamaProfile } from "@/shared/config";
import type { ModelManifest } from "@/shared/modelManifest";

import { ollamaShowSchema } from "../../schemas";
import type { OllamaFetch, OllamaModel } from "../../types";

/** A positive whole number from Ollama's model details, or `undefined`. */
const readCount = (info: Record<string, unknown>, key: string): number | undefined => {
  const value = info[key];

  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
};

/**
 * Describes an Ollama embedding model the way an installed model is described:
 * pinned to the digest Ollama reports, with its dimensions and context length
 * from Ollama's model details, and the role prefixes and pooling of its bundled
 * profile — Ollama does not publish those. Its vectors come normalised from
 * `/api/embed`, and are compared by cosine.
 *
 * @throws When Ollama does not say the model's dimensions.
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

  if (dimensions === undefined) {
    throw new Error(`Ollama does not say how many dimensions ${model.name} has.`);
  }

  const quantization = shown.details?.quantization_level ?? model.details?.quantization_level;

  return {
    manifestVersion: 1,
    reference: { hub: "ollama", repository: model.name, revision: model.digest },
    format: "local-server",
    ...(quantization === undefined ? {} : { quantization }),
    files: [],
    license: shown.license?.split("\n")[0]?.trim() || "unknown",
    contract: {
      family: "embedding",
      dimensions,
      maxInputTokens: contextLength ?? 512,
      pooling: profile?.pooling ?? "mean",
      normalize: true,
      similarity: "cosine",
      prefixes: profile?.prefixes ?? { query: "", document: "" },
    },
  };
};

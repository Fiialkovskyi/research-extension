import {
  buildOllamaManifest,
  createOllamaEmbedder,
  createOllamaGenerator,
  findOllamaProfile,
  matchesOllamaName,
  type OllamaFetch,
  type OllamaModel,
} from "@/features/ollama";
import type { GenerateRequest, GenerationStream } from "@/features/inference";
import { OLLAMA_ORIGIN } from "@/shared/config";
import type { EmbedConcepts } from "@/shared/resolveConceptKeys";

/** What the evals reach their models through. */
export interface OllamaConnection {
  generate: (request: GenerateRequest) => GenerationStream;
  /** Absent when no embedding model was asked for. */
  embed?: EmbedConcepts;
}

/**
 * Connects to the Ollama on this machine's loopback address, and to nothing else,
 * with the generation model, and with the embedding model when one is named.
 *
 * @throws With a message saying what to do, when Ollama is not running or does not
 *   have a model.
 */
export const connectOllama = async (
  fetchResource: OllamaFetch,
  models: { generation: string; embedding?: string },
): Promise<OllamaConnection> => {
  let installed: OllamaModel[];

  try {
    const response = await fetchResource(`${OLLAMA_ORIGIN}/api/tags`);

    installed = ((await response.json()) as { models: OllamaModel[] }).models;
  } catch {
    throw new Error(
      `Ollama is not answering at ${OLLAMA_ORIGIN}. Start it (\`ollama serve\`) and run the evals again.`,
    );
  }

  const describe = async (name: string) => {
    const model = installed.find((candidate) => matchesOllamaName(name, candidate.name));

    if (model === undefined) {
      throw new Error(`Ollama does not have ${name}. Pull it (\`ollama pull ${name}\`).`);
    }

    return buildOllamaManifest(fetchResource, OLLAMA_ORIGIN, model, findOllamaProfile(model.name));
  };
  const generator = createOllamaGenerator(
    fetchResource,
    OLLAMA_ORIGIN,
    await describe(models.generation),
  );

  if (models.embedding === undefined) {
    return { generate: generator.generate };
  }

  const embedder = createOllamaEmbedder(
    fetchResource,
    OLLAMA_ORIGIN,
    await describe(models.embedding),
  );

  return {
    generate: generator.generate,
    embed: (texts) => embedder.embed(texts, "document"),
  };
};

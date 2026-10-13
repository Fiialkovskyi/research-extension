/** What every Ollama profile says: which model, and whether to offer it. */
interface OllamaProfileBase {
  /**
   * Ollama's model name. Without a tag (`nomic-embed-text`) it stands for any
   * tag of that name; with one (`qwen3:4b`) for that tag only.
   */
  name: string;
  /** Offered on the options page when Ollama lacks it. */
  isRecommended: boolean;
  /** About how much Ollama downloads, shown before the user asks for it. */
  approximateSize: string;
}

/**
 * What the add-on knows about an Ollama embedding model that Ollama does not
 * say itself: which role prefixes it was trained with, and its pooling.
 */
export interface OllamaEmbeddingProfile extends OllamaProfileBase {
  family: "embedding";
  /** Role prefixes the model expects; empty where it needs none. */
  prefixes: { query: string; document: string };
  pooling: "mean" | "cls" | "last_token";
}

/** An Ollama model that writes text; Ollama applies its own chat template. */
export interface OllamaGenerationProfile extends OllamaProfileBase {
  family: "text-generation";
}

export type OllamaProfile = OllamaEmbeddingProfile | OllamaGenerationProfile;

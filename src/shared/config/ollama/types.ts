/**
 * What the add-on knows about an Ollama model that Ollama does not say itself:
 * which role prefixes it was trained with, and whether to recommend it.
 */
export interface OllamaProfile {
  /** Ollama's model name without its tag, such as `nomic-embed-text`. */
  name: string;
  family: "embedding" | "text-generation";
  /** Role prefixes the model expects; empty where it needs none. */
  prefixes: { query: string; document: string };
  pooling: "mean" | "cls" | "last_token";
  /** Offered on the options page when Ollama lacks it. */
  isRecommended: boolean;
  /** About how much Ollama downloads, shown before the user asks for it. */
  approximateSize: string;
}

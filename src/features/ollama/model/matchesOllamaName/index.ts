/**
 * Whether an Ollama model name is the one a profile or request names.
 *
 * A name without a tag stands for any tag of it, since Ollama adds `:latest`
 * to a bare name; a name with a tag stands for that tag only, so `qwen3:4b` is
 * never satisfied by `qwen3:0.6b`.
 */
export const matchesOllamaName = (wanted: string, modelName: string): boolean =>
  wanted.includes(":") ? wanted === modelName : wanted === modelName.split(":")[0];

import type { OllamaProfile } from "./types";

/**
 * Where a local Ollama server answers. Loopback only: nothing the add-on sends
 * there leaves the machine. Enumerated, like the model hosts, so the content
 * security policy and the optional permission cannot drift from the code.
 */
export const OLLAMA_ORIGIN = "http://127.0.0.1:11434";

/** Every local inference origin the policy admits. */
export const LOCAL_INFERENCE_ORIGINS = [OLLAMA_ORIGIN] as const;

/** Where the user gets Ollama, opened in a tab when it is not running. */
export const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";

/** Ollama models the add-on has profiles for. */
export const OLLAMA_PROFILES: readonly OllamaProfile[] = [
  {
    name: "nomic-embed-text",
    family: "embedding",
    prefixes: { query: "search_query: ", document: "search_document: " },
    pooling: "mean",
    isRecommended: true,
    approximateSize: "274 MB",
  },
  {
    name: "all-minilm",
    family: "embedding",
    prefixes: { query: "", document: "" },
    pooling: "mean",
    isRecommended: false,
    approximateSize: "46 MB",
  },
  {
    name: "mxbai-embed-large",
    family: "embedding",
    prefixes: {
      query: "Represent this sentence for searching relevant passages: ",
      document: "",
    },
    pooling: "cls",
    isRecommended: false,
    approximateSize: "670 MB",
  },
  {
    // Measured on the saved pages in `evals/`: 98% of the labelled facts found against 81% for
    // `qwen3:4b`, and the only model of the two whose summaries ever compare two products.
    name: "gemma4:12b",
    family: "text-generation",
    isRecommended: true,
    approximateSize: "7.7 GB",
  },
  {
    // A 4B model, the band REQ-NFR-007 budgets for outside the extension; the lighter choice.
    name: "qwen3:4b",
    family: "text-generation",
    isRecommended: false,
    approximateSize: "2.5 GB",
  },
];

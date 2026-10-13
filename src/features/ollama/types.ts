import type * as v from "valibot";

import type { ollamaModelEntrySchema, ollamaTagsSchema } from "./schemas";

/** A model Ollama has pulled, as `/api/tags` lists it. */
export type OllamaModel = v.InferOutput<typeof ollamaTagsSchema>["models"][number];

/** The `fetch` the add-on's background uses, under its content security policy. */
export type OllamaFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** A model as the options page lists it. */
export type OllamaModelEntry = v.InferOutput<typeof ollamaModelEntrySchema>;

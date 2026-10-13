import { OLLAMA_PROFILES, type OllamaProfile } from "@/shared/config";

/** The bundled profile for an Ollama model name, with or without its tag. */
export const findOllamaProfile = (name: string): OllamaProfile | undefined =>
  OLLAMA_PROFILES.find((profile) => profile.name === name.split(":")[0]);

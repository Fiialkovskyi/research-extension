import { OLLAMA_PROFILES } from "@/shared/config";
import type { StoredModel } from "@/shared/storage";

import type { OllamaModel, OllamaModelEntry } from "../../types";
import { findOllamaProfile } from "../findOllamaProfile";

const formatSize = (bytes: number): string =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;

/**
 * What the options page lists: every model Ollama has, with whether it is
 * registered and active, then each recommended model Ollama lacks, to download.
 */
export const listOllamaModelEntries = (
  pulled: readonly OllamaModel[],
  installed: readonly StoredModel[],
): OllamaModelEntry[] => {
  const registered = new Map(
    installed
      .filter(({ manifest }) => manifest.reference.hub === "ollama")
      .map((model) => [
        `${model.manifest.reference.repository}@${model.manifest.reference.revision}`,
        model,
      ]),
  );
  const present = pulled.map((model): OllamaModelEntry => {
    const profile = findOllamaProfile(model.name);
    const record = registered.get(`${model.name}@${model.digest}`);

    return {
      name: model.name,
      family: profile?.family ?? "unknown",
      isPulled: true,
      isRecommended: profile?.isRecommended ?? false,
      size: formatSize(model.size),
      registeredRef: record?.ref ?? null,
      isActive: record?.active === true,
    };
  });
  const pulledNames = new Set(pulled.map(({ name }) => name.split(":")[0]));
  const missing = OLLAMA_PROFILES.filter(
    ({ isRecommended, name }) => isRecommended && !pulledNames.has(name),
  ).map((profile): OllamaModelEntry => ({
    name: profile.name,
    family: profile.family,
    isPulled: false,
    isRecommended: true,
    size: profile.approximateSize,
    registeredRef: null,
    isActive: false,
  }));

  return [...present, ...missing];
};

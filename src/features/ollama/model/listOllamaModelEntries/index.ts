import { OLLAMA_PROFILES } from "@/shared/config";
import type { StoredModel } from "@/shared/storage";

import type { OllamaModel, OllamaModelEntry } from "../../types";
import { findOllamaProfile } from "../findOllamaProfile";
import { matchesOllamaName } from "../matchesOllamaName";

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
      // A model registered without a profile was described by the server itself.
      family: profile?.family ?? record?.manifest.contract.family ?? "unknown",
      isPulled: true,
      isRecommended: profile?.isRecommended ?? false,
      size: formatSize(model.size),
      registeredRef: record?.ref ?? null,
      isActive: record?.active === true,
    };
  });
  const missing = OLLAMA_PROFILES.filter(
    (profile) =>
      profile.isRecommended && !pulled.some(({ name }) => matchesOllamaName(profile.name, name)),
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

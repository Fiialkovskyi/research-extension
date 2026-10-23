import { matchesOllamaName, type OllamaModelEntry } from "@/features/ollama";
import { OLLAMA_PROFILES, type OllamaProfile } from "@/shared/config";

import { parseApproximateSize } from "./utils/parseApproximateSize";

/** One model "Turn on AI" will set up, and whether it has to be downloaded first. */
export interface TurnOnStep {
  name: string;
  family: OllamaProfile["family"];
  isPulled: boolean;
  /** About how much downloading it costs: nothing when Ollama has it already. */
  downloadBytes: number;
}

export interface TurnOnPlan {
  steps: TurnOnStep[];
  /** Everything the steps download together, said before the user clicks. */
  downloadBytes: number;
}

/** Embedding first: similar pages work as soon as it is on, while summaries still download. */
const FAMILY_ORDER: readonly OllamaProfile["family"][] = ["embedding", "text-generation"];

/**
 * What "Turn on AI" will do: the recommended model of each family, embedding
 * first, leaving out any that is already active and downloading only what
 * Ollama lacks.
 *
 * @param entries The models as the background lists them: Ollama's own, then
 *   each recommended one it lacks.
 */
export const buildTurnOnPlan = (
  entries: readonly OllamaModelEntry[],
  profiles: readonly OllamaProfile[] = OLLAMA_PROFILES,
): TurnOnPlan => {
  const steps = FAMILY_ORDER.flatMap((family): TurnOnStep[] => {
    if (entries.some((entry) => entry.family === family && entry.isActive)) {
      return [];
    }

    const profile = profiles.find(
      (candidate) => candidate.family === family && candidate.isRecommended,
    );

    if (profile === undefined) {
      return [];
    }

    const pulled = entries.find(
      (entry) => entry.isPulled && matchesOllamaName(profile.name, entry.name),
    );

    return [
      {
        name: pulled?.name ?? profile.name,
        family,
        isPulled: pulled !== undefined,
        downloadBytes: pulled === undefined ? parseApproximateSize(profile.approximateSize) : 0,
      },
    ];
  });

  return { steps, downloadBytes: steps.reduce((total, step) => total + step.downloadBytes, 0) };
};

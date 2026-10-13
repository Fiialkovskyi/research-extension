import type { OllamaReference } from "@/shared/modelManifest";

import type { OllamaFetch } from "../../types";
import { readOllamaStatus } from "../readOllamaStatus";

/**
 * Checks that Ollama is running, admits this extension, and still has the
 * model at the digest it was registered with.
 *
 * A model re-pulled under its name is different weights: its vectors would not
 * belong to the registered space, and its answers were never judged by the
 * conformance suite. So it is refused rather than used.
 *
 * @throws When Ollama is not running, refuses the extension, or no longer has
 *   the model as registered.
 */
export const assertOllamaServesModel = async (
  fetchResource: OllamaFetch,
  origin: string,
  reference: OllamaReference,
): Promise<void> => {
  const status = await readOllamaStatus(fetchResource, origin);

  if (status.state !== "running") {
    throw new Error(
      status.state === "refused"
        ? `Ollama at ${origin} refused this extension.`
        : `Ollama is not running at ${origin}.`,
    );
  }

  const current = status.models.find(({ name }) => name === reference.repository);

  if (current?.digest !== reference.revision) {
    throw new Error(
      `${reference.repository} changed in Ollama since it was registered; register it again.`,
    );
  }
};

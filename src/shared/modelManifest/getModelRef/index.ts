import type { ModelReference } from "../types";

/**
 * Stable identity of an installed model: repository and the commit it is pinned
 * to. Used as the storage key, so two revisions of one repository coexist
 * rather than overwriting each other.
 */
export const getModelRef = (reference: ModelReference): string => {
  return reference.hub === "ollama"
    ? `ollama:${reference.repository}@${reference.revision}`
    : `${reference.repository}@${reference.revision}`;
};

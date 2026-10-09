import type { ModelReference } from "../constants";

/**
 * Stable identity of an installed model: repository and the commit it is pinned
 * to. Used as the storage key, so two revisions of one repository coexist
 * rather than overwriting each other.
 */
export const getModelRef = (reference: ModelReference): string => {
  return `${reference.repository}@${reference.revision}`;
};

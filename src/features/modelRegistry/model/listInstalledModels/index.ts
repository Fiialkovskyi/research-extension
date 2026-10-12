import type { IDBPDatabase } from "idb";

import { MODEL_STORE, type ResearchDatabaseSchema } from "@/shared/storage";
import type { InstalledModelSummary } from "../../types";

/**
 * Lists what is installed, newest first, flattened for rendering.
 *
 * Flattened rather than returning the stored records because a surface needs
 * the pinned revision, the family and the disk use side by side, and digging
 * those out of a nested manifest in a component would put knowledge of the
 * manifest's shape into the view.
 */
export const listInstalledModels = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<InstalledModelSummary[]> => {
  const installed = await database.getAll(MODEL_STORE);

  return installed
    .map((model) => ({
      ref: model.ref,
      repository: model.manifest.reference.repository,
      revision: model.manifest.reference.revision,
      family: model.manifest.contract.family,
      quantization: model.manifest.quantization,
      conformance: model.conformance,
      conformanceReason: model.conformanceReason,
      diskBytes: model.diskBytes,
      active: model.active,
      installedAt: model.installedAt,
    }))
    .toSorted((left, right) => right.installedAt - left.installedAt);
};

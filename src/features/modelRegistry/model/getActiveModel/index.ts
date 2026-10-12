import type { IDBPDatabase } from "idb";

import type { ModelFamily } from "@/shared/modelManifest";
import { MODEL_STORE, type ResearchDatabaseSchema, type StoredModel } from "@/shared/storage";

/**
 * The only way feature code reaches a model.
 *
 * Features ask for a family, never for a repository, so a model can be swapped
 * without touching the code that uses it. Two conditions must both hold: the
 * user activated it, and it passed its family's conformance suite. Checking
 * conformance here as well as at activation is deliberate — it means a record
 * written by an older build, or by a bug, still cannot put a model that failed
 * its probes behind a feature.
 *
 * @returns the active model, or nothing when none is available for that family.
 */
export const getActiveModel = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  family: ModelFamily,
): Promise<StoredModel | undefined> => {
  const installed = await database.getAllFromIndex(MODEL_STORE, "family", family);
  const usable = installed.filter((model) => model.active && model.conformance === "passed");

  // One active model per family is the invariant activation maintains. Should
  // two ever be recorded, the most recently installed wins rather than
  // whichever the index happened to return first, so the choice is at least
  // deterministic and explicable.
  return usable.toSorted((left, right) => right.installedAt - left.installedAt)[0];
};

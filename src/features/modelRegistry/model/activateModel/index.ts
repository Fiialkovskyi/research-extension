import type { IDBPDatabase } from "idb";

import type { ConformanceOutcome } from "@/features/modelConformance";
import type { ModelContract } from "@/shared/modelManifest";
import { MODEL_STORE, type ModelDatabaseSchema, type StoredModel } from "@/shared/storage";

export interface ActivateModelOptions {
  ref: string;
  database: IDBPDatabase<ModelDatabaseSchema>;
  /**
   * Runs the family's conformance suite against this model.
   *
   * Injected because running it means loading the model into the inference
   * worker, which the registry has no business knowing about — and because it
   * lets every activation outcome be tested without a model.
   */
  runConformance: (model: StoredModel) => Promise<ConformanceOutcome>;
}

/**
 * Activates a model, but only if it passes its family's conformance suite.
 *
 * The suite runs on every activation rather than once at install: the result
 * depends on the runtime and the device as much as on the weights, so a model
 * that passed on one machine has not been shown to pass on this one.
 *
 * A failure is recorded, not merely refused. The stored reason is what lets the
 * surface explain itself later, and it stops the same broken model being
 * offered as though nothing had been tried.
 *
 * At most one model per family stays active, so a feature asking for a family
 * gets an unambiguous answer.
 *
 * @returns the model as recorded afterwards, active or refused.
 * @throws when no such model is installed.
 */
export const activateModel = async (options: ActivateModelOptions): Promise<StoredModel> => {
  const { ref, database, runConformance } = options;
  const model = await database.get(MODEL_STORE, ref);

  if (model === undefined) {
    throw new Error(`No model is installed under "${ref}".`);
  }

  const outcome = await runConformance(model);

  const recorded: StoredModel = {
    ...model,
    conformance: outcome.passed ? "passed" : "failed",
    conformanceReason: outcome.reason,
    active: outcome.passed,
  };

  await database.put(MODEL_STORE, recorded);

  if (outcome.passed) {
    await deactivateOthers(database, recorded.ref, recorded.manifest.contract.family);
  }

  return recorded;
};

/** Leaves exactly one active model per family. */
const deactivateOthers = async (
  database: IDBPDatabase<ModelDatabaseSchema>,
  activeRef: string,
  family: ModelContract["family"],
): Promise<void> => {
  const siblings = await database.getAllFromIndex(MODEL_STORE, "family", family);

  await Promise.all(
    siblings
      .filter((sibling) => sibling.ref !== activeRef && sibling.active)
      .map((sibling) => database.put(MODEL_STORE, { ...sibling, active: false })),
  );
};

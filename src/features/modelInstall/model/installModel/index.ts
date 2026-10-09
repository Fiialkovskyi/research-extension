import type { IDBPDatabase } from "idb";

import { buildModelManifest, resolveModelRevision } from "@/features/modelRegistry";
import type { ModelProfile } from "@/shared/config";
import { getModelRef } from "@/shared/modelManifest";
import { MODEL_STORE, type ModelDatabaseSchema, type StoredModel } from "@/shared/storage";
import { downloadModelFiles, type InstallProgress } from "../downloadModelFiles";
import { getModelTreeUrl } from "./utils/getModelTreeUrl";
import { readRepositoryJson } from "./utils/readRepositoryJson";

export interface InstallModelOptions {
  profile: ModelProfile;
  database: IDBPDatabase<ModelDatabaseSchema>;
  fetchResource: typeof fetch;
  onProgress?: (progress: InstallProgress) => void;
}

/**
 * Installs a bundled profile: pin, describe, fetch, verify, record.
 *
 * The order matters. The revision is settled first, so everything afterwards
 * addresses one immutable commit. The manifest is derived next, because it is
 * what makes the files verifiable — fetching before describing would mean
 * downloading bytes with nothing to check them against. Only then are files
 * fetched, and the model is recorded last.
 *
 * The recorded model is **not** active and its conformance is pending. Nothing
 * may use a model until its family's probes have passed, and that is a separate
 * step with its own outcome; recording it as usable here would let a model that
 * cannot honour its contract reach a feature.
 *
 * @returns the recorded model, awaiting conformance.
 * @throws when the revision cannot be pinned, the repository does not describe
 *   itself sufficiently, or any file fails verification.
 */
export const installModel = async (options: InstallModelOptions): Promise<StoredModel> => {
  const { profile, database, fetchResource, onProgress } = options;

  const revision = await resolveModelRevision(profile.repository, profile.revision, fetchResource);
  const reference = { hub: "huggingface", repository: profile.repository, revision } as const;

  const treeResponse = await fetchResource(getModelTreeUrl(profile.repository, revision), {
    credentials: "omit",
    headers: { accept: "application/json" },
  });

  if (!treeResponse.ok) {
    throw new Error(
      `Could not list ${profile.repository}@${revision}: the hub answered ${treeResponse.status}.`,
    );
  }

  const [tree, config, tokenizerConfig] = await Promise.all([
    treeResponse.json(),
    readRepositoryJson(reference, "config.json", fetchResource),
    readRepositoryJson(reference, "tokenizer_config.json", fetchResource),
  ]);

  const manifest = buildModelManifest({
    profile: { ...profile, revision },
    config,
    tokenizerConfig,
    tree,
  });
  const { diskBytes } = await downloadModelFiles({ manifest, database, fetchResource, onProgress });

  const model: StoredModel = {
    ref: getModelRef(reference),
    manifest,
    active: false,
    conformance: "pending",
    diskBytes,
    installedAt: Date.now(),
  };

  await database.put(MODEL_STORE, model);

  return model;
};

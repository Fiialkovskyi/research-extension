import type { IDBPDatabase } from "idb";

import { getModelRef, type ModelManifest } from "@/shared/modelManifest";
import { MODEL_FILE_STORE, type ModelDatabaseSchema } from "@/shared/storage";
import { assertFileDigest } from "../assertFileDigest";
import { getHuggingFaceFileUrl } from "@/shared/huggingFace";
import { removeStoredFiles } from "./utils/removeStoredFiles";

/** How far an install has got. Reported per file, not per chunk. */
export interface InstallProgress {
  /** The file being fetched now. */
  path: string;
  completedFiles: number;
  totalFiles: number;
  completedBytes: number;
  totalBytes: number;
}

export interface DownloadModelFilesOptions {
  manifest: ModelManifest;
  database: IDBPDatabase<ModelDatabaseSchema>;
  fetchResource: typeof fetch;
  onProgress?: (progress: InstallProgress) => void;
}

/**
 * Fetches a model's files, verifies each one, and stores what matched.
 *
 * Files are fetched one at a time rather than together. A generative model runs
 * to hundreds of megabytes in a single file, and holding several of those in
 * memory at once to save a little wall time is a poor trade in a browser
 * extension; sequential transfer also makes progress meaningful.
 *
 * Nothing is stored before its digest matches, and if any file fails, every
 * file written for this model is removed again. A half-installed model is worse
 * than none: the runtime would load it and fail somewhere far less explicable.
 *
 * Re-running against an already-complete model does no work and no requests.
 * Stored files were verified when they were written, so there is nothing to
 * check and nothing to fetch.
 *
 * @returns how much disk the installed files occupy.
 * @throws when a request fails or a file does not match its manifest.
 */
export const downloadModelFiles = async (
  options: DownloadModelFilesOptions,
): Promise<{ diskBytes: number }> => {
  const { manifest, database, fetchResource, onProgress } = options;
  const ref = getModelRef(manifest.reference);

  const stored = await database.getAllFromIndex(MODEL_FILE_STORE, "ref", ref);
  const storedPaths = new Set(stored.map((file) => file.path));
  const totalBytes = manifest.files.reduce((total, file) => total + file.bytes, 0);

  if (manifest.files.every((file) => storedPaths.has(file.path))) {
    return { diskBytes: totalBytes };
  }

  let completedBytes = 0;
  let completedFiles = 0;

  try {
    for (const file of manifest.files) {
      onProgress?.({
        path: file.path,
        completedFiles,
        totalFiles: manifest.files.length,
        completedBytes,
        totalBytes,
      });

      if (!storedPaths.has(file.path)) {
        const url = getHuggingFaceFileUrl(manifest.reference, file.path);
        const response = await fetchResource(url, { credentials: "omit" });

        if (!response.ok) {
          throw new Error(`Could not fetch "${file.path}": the hub answered ${response.status}.`);
        }

        const contents = await response.arrayBuffer();

        await assertFileDigest(file.path, contents, file.digest);
        await database.put(MODEL_FILE_STORE, { ref, path: file.path, contents });
      }

      completedBytes += file.bytes;
      completedFiles += 1;
    }
  } catch (error) {
    await removeStoredFiles(database, ref);
    throw error;
  }

  onProgress?.({
    path: "",
    completedFiles,
    totalFiles: manifest.files.length,
    completedBytes,
    totalBytes,
  });

  return { diskBytes: totalBytes };
};

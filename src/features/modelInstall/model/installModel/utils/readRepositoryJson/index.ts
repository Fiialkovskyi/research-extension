import type { ModelReference } from "@/shared/modelManifest";
import { getHuggingFaceFileUrl } from "@/shared/huggingFace";

/**
 * Reads one JSON document out of a repository at its pinned revision.
 *
 * Used for the configuration files a manifest is derived from. These are read
 * before the manifest exists, so there is no digest to check them against yet —
 * which is exactly why they are only ever used to derive declared values, and
 * why the files that matter are verified separately once the manifest names
 * their digests.
 *
 * @throws when the document cannot be fetched or is not JSON.
 */
export const readRepositoryJson = async (
  reference: ModelReference,
  path: string,
  fetchResource: typeof fetch,
): Promise<unknown> => {
  const response = await fetchResource(getHuggingFaceFileUrl(reference, path), {
    credentials: "omit",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Could not read "${path}" from ${reference.repository}: the hub answered ${response.status}.`,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`"${path}" in ${reference.repository} is not valid JSON.`);
  }
};

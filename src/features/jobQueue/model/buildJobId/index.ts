import type { JobIdentity } from "../../types";

/**
 * Derives a job's id from the work it does: SHA-256, in hex, of its type, its
 * sorted input hashes and its producer version.
 *
 * The inputs are sorted so that the same inputs listed in another order are
 * the same job. A new producer version is a new job, because its output would
 * differ.
 */
export const buildJobId = async ({
  type,
  inputHashes,
  producerVersion,
}: JobIdentity): Promise<string> => {
  const canonical = JSON.stringify([type, inputHashes.toSorted(), producerVersion]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

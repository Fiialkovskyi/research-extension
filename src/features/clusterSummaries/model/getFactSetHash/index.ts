/**
 * Identifies a set of facts: the SHA-256 of their ids, sorted, so the same set
 * hashes the same whatever order it was read in. A page captured again gives
 * its facts new ids, so its new facts make a new set.
 */
export const getFactSetHash = async (factIds: readonly string[]): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(factIds.toSorted().join("\n")),
  );

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

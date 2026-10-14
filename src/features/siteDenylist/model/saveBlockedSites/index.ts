import type { IDBPDatabase } from "idb";

import { encryptBytes, getDataKey } from "@/features/dataProtection";
import { BLOCKED_SITES_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Replaces the sites the user added to the capture denylist, encrypted,
 * de-duplicated and sorted. The caller passes hosts `parseBlockedSite` read.
 * An empty list deletes the record.
 *
 * @returns The list as stored.
 */
export const saveBlockedSites = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sites: readonly string[],
): Promise<string[]> => {
  const stored = [...new Set(sites)].toSorted();

  if (stored.length === 0) {
    await database.delete(BLOCKED_SITES_STORE, "user");
    return stored;
  }

  const sealed = await encryptBytes(
    await getDataKey(database),
    new TextEncoder().encode(JSON.stringify(stored)),
  );

  await database.put(BLOCKED_SITES_STORE, {
    id: "user",
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedSites: sealed.ciphertext,
  });

  return stored;
};

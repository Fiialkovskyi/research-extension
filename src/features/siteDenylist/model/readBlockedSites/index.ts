import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import { decryptBytes, getDataKey } from "@/features/dataProtection";
import { BLOCKED_SITES_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * The sites the user added to the capture denylist (REQ-SEC-007), decrypted.
 *
 * @returns The hosts, sorted; none when nothing was added or the record
 *   cannot be read.
 */
export const readBlockedSites = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<string[]> => {
  const stored = await database.get(BLOCKED_SITES_STORE, "user");

  if (stored === undefined) {
    return [];
  }

  try {
    const plain = await decryptBytes(await getDataKey(database), {
      keyId: stored.keyId,
      cipher: "aes-gcm-256",
      iv: stored.iv,
      ciphertext: stored.encryptedSites,
    });

    return v.parse(v.array(v.string()), JSON.parse(new TextDecoder().decode(plain)));
  } catch {
    // A list that cannot be read is no list; the bundled one still applies.
    return [];
  }
};

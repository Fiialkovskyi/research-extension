import type { IDBPDatabase } from "idb";

import { KEY_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import { DATA_KEY_ID } from "../../constants";
import type { DataKey } from "../../types";

/**
 * Returns the extension's data key, creating it on first need (REQ-SEC-005).
 *
 * The key is AES-GCM, 256 bits, and not extractable: it can encrypt and
 * decrypt, but no script can read its bytes. It is kept in the database by
 * structured clone, so it is the same key after every restart.
 *
 * Generating a key cannot happen inside a transaction, which would commit
 * while it waited. So two first needs may both generate one; storing with
 * `add` lets only the first in, and the other reads back the stored key.
 */
export const getDataKey = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<DataKey> => {
  const stored = await database.get(KEY_STORE, DATA_KEY_ID);

  if (stored !== undefined) {
    return { id: stored.id, key: stored.key };
  }

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);

  try {
    await database.add(KEY_STORE, {
      id: DATA_KEY_ID,
      key,
      algorithm: "AES-GCM",
      createdAt: Date.now(),
    });

    return { id: DATA_KEY_ID, key };
  } catch (error) {
    const winner = await database.get(KEY_STORE, DATA_KEY_ID);

    if (winner === undefined) {
      throw error;
    }

    return { id: winner.id, key: winner.key };
  }
};

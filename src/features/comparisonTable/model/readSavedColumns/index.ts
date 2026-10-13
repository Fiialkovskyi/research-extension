import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import { type DataKey, decryptBytes } from "@/features/dataProtection";
import { normalizeEntityName } from "@/shared/normalizeEntityName";
import { type ResearchDatabaseSchema, TABLE_COLUMNS_STORE } from "@/shared/storage";

/** The id a session's column choice for a type is stored under. */
export const getTableColumnsId = (sessionId: string, entityType: string): string =>
  `${sessionId}:${normalizeEntityName(entityType)}`;

/**
 * Reads the columns the user chose for a session's table of a type.
 *
 * @returns The attribute keys, in the user's order, or `undefined` when none
 *   were chosen or the choice cannot be read.
 */
export const readSavedColumns = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  dataKey: DataKey,
  sessionId: string,
  entityType: string,
): Promise<string[] | undefined> => {
  const stored = await database.get(TABLE_COLUMNS_STORE, getTableColumnsId(sessionId, entityType));

  if (stored === undefined) {
    return undefined;
  }

  try {
    const plain = await decryptBytes(dataKey, {
      keyId: stored.keyId,
      cipher: "aes-gcm-256",
      iv: stored.iv,
      ciphertext: stored.encryptedColumns,
    });

    return v.parse(v.array(v.string()), JSON.parse(new TextDecoder().decode(plain)));
  } catch {
    // A choice that cannot be read is no choice: the table proposes its columns.
    return undefined;
  }
};

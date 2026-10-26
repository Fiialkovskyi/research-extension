import type { IDBPDatabase } from "idb";

import { encryptBytes, getDataKey } from "@/features/dataProtection";
import { type ResearchDatabaseSchema, TABLE_COLUMNS_STORE, SESSION_STORE } from "@/shared/storage";

import { getTableColumnsId } from "../readSavedColumns";

/**
 * Keeps the columns the user chose for the live session's table of a type,
 * encrypted — attribute names come from page content. An empty list forgets
 * the choice, so the table proposes its columns again.
 *
 * @returns Whether there was a live session to keep it for.
 */
export const saveTableColumns = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  entityType: string,
  columns: readonly string[],
): Promise<boolean> => {
  const session = await database.get(SESSION_STORE, sessionId);

  if (session === undefined) {
    return false;
  }

  const id = getTableColumnsId(session.id, entityType);

  if (columns.length === 0) {
    await database.delete(TABLE_COLUMNS_STORE, id);
    return true;
  }

  const sealed = await encryptBytes(
    await getDataKey(database),
    new TextEncoder().encode(JSON.stringify(columns)),
  );

  await database.put(TABLE_COLUMNS_STORE, {
    id,
    sessionId: session.id,
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedColumns: sealed.ciphertext,
  });

  return true;
};

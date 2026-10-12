import type { IDBPDatabase } from "idb";

import { decryptBytes, getDataKey } from "@/features/dataProtection";
import { type ResearchDatabaseSchema, SNAPSHOT_STORE } from "@/shared/storage";

import { decompressText } from "./utils/decompressText";

/**
 * Reads a snapshot's text back: decrypted with the data key, then inflated.
 *
 * @returns The text, or `undefined` when no snapshot has that id.
 * @throws When the snapshot cannot be decrypted — another key, or altered
 *   ciphertext — rather than returning anything but the stored text.
 */
export const readSnapshotText = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  snapshotId: string,
): Promise<string | undefined> => {
  const snapshot = await database.get(SNAPSHOT_STORE, snapshotId);

  if (snapshot === undefined) {
    return undefined;
  }

  const compressed = await decryptBytes(await getDataKey(database), {
    keyId: snapshot.keyId,
    cipher: snapshot.cipher,
    iv: snapshot.iv,
    ciphertext: snapshot.encryptedText,
  });

  return decompressText(compressed);
};

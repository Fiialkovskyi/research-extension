import type { IDBPDatabase } from "idb";

import { decryptBytes, encryptBytes, getDataKey } from "@/features/dataProtection";
import { type ResearchDatabaseSchema, SNAPSHOT_STORE, type StoredSnapshot } from "@/shared/storage";

/** A snapshot as versions before encryption stored it: compressed, in the clear. */
type PlaintextSnapshot = Omit<StoredSnapshot, "keyId" | "cipher" | "iv" | "encryptedText"> & {
  compressedText: ArrayBuffer;
};

const isPlaintext = (record: unknown): record is PlaintextSnapshot =>
  typeof record === "object" &&
  record !== null &&
  "compressedText" in record &&
  !("encryptedText" in record);

const isSameBytes = (first: ArrayBuffer, second: ArrayBuffer): boolean => {
  const a = new Uint8Array(first);
  const b = new Uint8Array(second);

  return a.length === b.length && a.every((byte, index) => byte === b[index]);
};

/**
 * Encrypts every snapshot an earlier version stored in the clear (REQ-SEC-005).
 *
 * Not a migration step: Web Crypto is asynchronous, and a version-change
 * transaction would commit while it waited. The background runs this when it
 * starts or is updated instead. Each record is rewritten on its own, and only
 * once its ciphertext has been checked to decrypt back to the same bytes, so
 * an interruption leaves every record either as it was or sealed, never half.
 *
 * @returns How many snapshots were sealed.
 */
export const sealPlaintextSnapshots = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<number> => {
  const plaintext = ((await database.getAll(SNAPSHOT_STORE)) as unknown[]).filter(isPlaintext);

  if (plaintext.length === 0) {
    return 0;
  }

  const dataKey = await getDataKey(database);
  let sealedCount = 0;

  for (const { compressedText, ...rest } of plaintext) {
    const sealed = await encryptBytes(dataKey, compressedText);

    if (!isSameBytes(await decryptBytes(dataKey, sealed), compressedText)) {
      throw new Error(`Snapshot "${rest.id}" did not survive encryption; it was left as it was.`);
    }

    await database.put(SNAPSHOT_STORE, {
      ...rest,
      keyId: sealed.keyId,
      cipher: sealed.cipher,
      iv: sealed.iv,
      encryptedText: sealed.ciphertext,
    });
    sealedCount += 1;
  }

  return sealedCount;
};

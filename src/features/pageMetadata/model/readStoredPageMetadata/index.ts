import type { IDBPDatabase } from "idb";

import { decryptBytes, getDataKey } from "@/features/dataProtection";
import {
  PAGE_METADATA_STORE,
  type ResearchDatabaseSchema,
  type StoredPageMetadata,
} from "@/shared/storage";

import type { PageMetadata } from "../../types";

/** A node's stored metadata, its description opened. */
export type ReadPageMetadata = PageMetadata & Pick<StoredPageMetadata, "nodeId" | "capturedAt">;

/**
 * Reads what a node's page said about itself, the description decrypted with
 * the data key.
 *
 * @returns The metadata, or `undefined` when the node has none.
 * @throws When the description cannot be decrypted — another key, or altered
 *   ciphertext — rather than returning anything but the stored text.
 */
export const readStoredPageMetadata = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  nodeId: string,
): Promise<ReadPageMetadata | undefined> => {
  const record = await database.get(PAGE_METADATA_STORE, nodeId);

  if (record === undefined) {
    return undefined;
  }

  const { keyId, cipher, iv, encryptedDescription, sessionId: _sessionId, ...rest } = record;

  if (
    keyId === undefined ||
    cipher === undefined ||
    iv === undefined ||
    encryptedDescription === undefined
  ) {
    return rest;
  }

  const description = new TextDecoder().decode(
    await decryptBytes(await getDataKey(database), {
      keyId,
      cipher,
      iv,
      ciphertext: encryptedDescription,
    }),
  );

  return { ...rest, description };
};

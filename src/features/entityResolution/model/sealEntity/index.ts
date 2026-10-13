import { type DataKey, encryptBytes } from "@/features/dataProtection";
import type { StoredEntity } from "@/shared/storage";

import type { SealedEntity } from "../../types";

/**
 * Builds an entity's stored record, its name and type encrypted with the data
 * key; its session and merge state stay readable.
 */
export const sealEntity = async (
  dataKey: DataKey,
  entity: SealedEntity,
  record: Pick<StoredEntity, "id" | "sessionId" | "isSeparated" | "createdAt"> & {
    mergedInto?: string;
  },
): Promise<StoredEntity> => {
  const sealed = await encryptBytes(dataKey, new TextEncoder().encode(JSON.stringify(entity)));

  return {
    ...record,
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedEntity: sealed.ciphertext,
  };
};

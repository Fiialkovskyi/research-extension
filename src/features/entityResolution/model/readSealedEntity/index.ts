import * as v from "valibot";

import { type DataKey, decryptBytes } from "@/features/dataProtection";
import type { StoredEntity } from "@/shared/storage";

import { sealedEntitySchema } from "../../schemas";
import type { SealedEntity } from "../../types";

/**
 * Decrypts a stored entity's name and type.
 *
 * @throws When they do not decrypt, or are not an entity's.
 */
export const readSealedEntity = async (
  dataKey: DataKey,
  entity: StoredEntity,
): Promise<SealedEntity> => {
  const plain = await decryptBytes(dataKey, {
    keyId: entity.keyId,
    cipher: "aes-gcm-256",
    iv: entity.iv,
    ciphertext: entity.encryptedEntity,
  });

  return v.parse(sealedEntitySchema, JSON.parse(new TextDecoder().decode(plain)));
};

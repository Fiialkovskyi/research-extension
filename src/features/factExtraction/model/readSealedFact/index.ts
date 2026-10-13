import * as v from "valibot";

import { type DataKey, decryptBytes } from "@/features/dataProtection";
import type { StoredFact } from "@/shared/storage";

import { sealedFactSchema } from "../../schemas";
import type { SealedFact } from "../../types";

/**
 * Decrypts a stored fact's text. A fact stored before the subject's type was
 * kept reads as type `unknown`.
 *
 * @throws When the text does not decrypt, or is not a fact's.
 */
export const readSealedFact = async (dataKey: DataKey, fact: StoredFact): Promise<SealedFact> => {
  const plain = await decryptBytes(dataKey, {
    keyId: fact.keyId,
    cipher: "aes-gcm-256",
    iv: fact.iv,
    ciphertext: fact.encryptedFact,
  });

  return v.parse(sealedFactSchema, JSON.parse(new TextDecoder().decode(plain)));
};

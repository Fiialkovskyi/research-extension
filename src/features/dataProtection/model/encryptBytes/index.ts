import { DATA_CIPHER, IV_BYTES } from "../../constants";
import type { DataKey, SealedBytes } from "../../types";

/**
 * Encrypts bytes with the data key under a fresh random IV.
 *
 * The bytes are handed over as a view, which Web Crypto accepts from any
 * realm; a bare `ArrayBuffer` made by another realm's streams is refused.
 */
export const encryptBytes = async (
  dataKey: DataKey,
  bytes: ArrayBuffer | Uint8Array,
): Promise<SealedBytes> => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dataKey.key,
    new Uint8Array(bytes),
  );

  return { keyId: dataKey.id, cipher: DATA_CIPHER, iv, ciphertext };
};

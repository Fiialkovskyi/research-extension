import { DATA_CIPHER } from "../../constants";
import type { DataKey, SealedBytes } from "../../types";

/**
 * Decrypts bytes the data key sealed.
 *
 * @throws When they were sealed by another key or cipher, or fail AES-GCM's
 *   authentication: altered content is refused, never returned.
 */
export const decryptBytes = async (dataKey: DataKey, sealed: SealedBytes): Promise<ArrayBuffer> => {
  if (sealed.keyId !== dataKey.id) {
    throw new Error(`Sealed by key "${sealed.keyId}", not by the data key "${dataKey.id}".`);
  }

  if (sealed.cipher !== DATA_CIPHER) {
    throw new Error(`Sealed with an unknown cipher "${String(sealed.cipher)}".`);
  }

  try {
    return await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(sealed.iv) },
      dataKey.key,
      new Uint8Array(sealed.ciphertext),
    );
  } catch {
    throw new Error("The sealed content failed authentication and was not decrypted.");
  }
};

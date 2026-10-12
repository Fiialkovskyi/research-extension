import type { DATA_CIPHER } from "./constants";

/** The data key, with the id that sealed records name it by. */
export interface DataKey {
  id: string;
  key: CryptoKey;
}

/** Bytes encrypted with the data key, with everything needed to decrypt them. */
export interface SealedBytes {
  keyId: string;
  cipher: typeof DATA_CIPHER;
  /** Random, unique per encryption. */
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}

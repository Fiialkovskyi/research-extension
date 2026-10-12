/**
 * Data protection: the extension's data key, and encrypting stored content
 * with it at rest (REQ-SEC-005).
 *
 * Guards against copied profile files and other extensions — not against code
 * running as this extension, or a compromised account (target spec §10).
 */

export { DATA_CIPHER, DATA_KEY_ID } from "./constants";
export type { DataKey, SealedBytes } from "./types";
export { decryptBytes } from "./model/decryptBytes";
export { encryptBytes } from "./model/encryptBytes";
export { getDataKey } from "./model/getDataKey";

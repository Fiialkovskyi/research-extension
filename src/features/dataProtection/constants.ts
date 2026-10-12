/** The id the data key is stored under. One key until rotation exists. */
export const DATA_KEY_ID = "data-key-1";

/** The cipher every sealed record names, so a later change of cipher can tell old records. */
export const DATA_CIPHER = "aes-gcm-256";

/** AES-GCM's recommended IV length, in bytes. */
export const IV_BYTES = 12;

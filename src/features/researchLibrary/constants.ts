/**
 * How long saving waits for each open page to send what it holds. A page that
 * does not answer by then — no observer, or a slow one — is not waited for.
 */
export const SAVE_FLUSH_TIMEOUT_MS = 1_000;

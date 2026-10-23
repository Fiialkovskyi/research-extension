/**
 * Whether models that run inside the extension (transformers.js weights
 * fetched from Hugging Face) are offered.
 *
 * Off: the local Ollama server is, for now, the only backend, so setting AI up
 * is one path rather than two. The in-extension code, its tests and the models
 * a profile already stored are all kept; turning this on restores them, and
 * with them the model-host origins in the manifest's host permissions and
 * `connect-src` (see `wxt.config.ts`).
 */
export const IS_IN_BROWSER_BACKEND_ENABLED = false;

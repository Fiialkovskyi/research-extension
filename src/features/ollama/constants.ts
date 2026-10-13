/** How long a status check waits before calling the server unreachable. */
export const OLLAMA_STATUS_TIMEOUT_MS = 2_000;

/**
 * How a job's failure reason reads when the local server was not there to
 * answer — the wording `createOllamaEmbedder` throws. Such a job is waiting for
 * Ollama, not broken, and is retried once Ollama answers again.
 */
export const LOCAL_SERVER_FAILURE_PATTERN = /^Ollama (is not running|at \S+ refused)/u;

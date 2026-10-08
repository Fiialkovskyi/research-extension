import { ACTOR_ERROR_PREFIX } from "../../../constants";

/**
 * Separates "not ready yet" from "actually broken".
 *
 * A null result means the popup has not loaded and the caller should keep
 * polling; a prefixed string means the actor itself failed, and polling past
 * that would turn a clear error into an unexplained timeout.
 *
 * @throws If the actor reported a failure.
 */
export function interpretReaderResult(result: unknown): string | null {
  if (typeof result === "string" && result.startsWith(ACTOR_ERROR_PREFIX)) {
    throw new Error(`Reading the popup failed: ${result.slice(ACTOR_ERROR_PREFIX.length)}`);
  }

  return (result ?? null) as string | null;
}

import { KEEP_ALIVE_INTERVAL_MS } from "../../constants";

/** Ends a hold. Calling it again does nothing. */
export type ReleaseHold = () => void;

/**
 * Keeps the background event page from being unloaded as idle while long work
 * runs, with no extension page open to keep it company.
 *
 * A pending `fetch` does not count as activity to Firefox; whether an API call
 * does is what spike M0-1 measures (`spike-event-page-lifetime`). The hold
 * calls `touch` — a cheap read-only browser call, supplied by the entry point —
 * every `intervalMs`, {@link KEEP_ALIVE_INTERVAL_MS} unless told otherwise. A touch
 * that fails is ignored: it is a signal, not work, and the next one may land.
 *
 * Release in a `finally`, so an idle extension unloads again as before.
 */
export const holdBackgroundAlive = (
  touch: () => Promise<unknown>,
  intervalMs: number = KEEP_ALIVE_INTERVAL_MS,
): ReleaseHold => {
  const timer = setInterval(() => {
    touch().catch(() => undefined);
  }, intervalMs);

  return () => {
    clearInterval(timer);
  };
};

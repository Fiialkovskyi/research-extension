import type { StoredHeartbeat } from "@/shared/storage";

import { PROBE_SILENCE_LIMIT_MS } from "../../constants";
import type { ProbeOutcome } from "../../types";

/**
 * Reads how a probe run ended from its heartbeats.
 *
 * - `completed`: it held for its whole hold within one page load.
 * - `resumed`: it held for its whole hold, but more than one page load wrote
 *   its beats — the page was unloaded and woken in between.
 * - `running`: it has not finished and beat recently.
 * - `stopped`: it has not finished and has been silent too long; the page
 *   that ran it is gone. `lastSeenMs` says how far it got.
 *
 * The longest gap between consecutive beats is reported in every case: a gap
 * longer than the idle timeout is an unload, whatever came after it.
 *
 * @returns Nothing for a run with no beats.
 */
export const readProbeOutcome = (
  heartbeats: readonly StoredHeartbeat[],
  now: number,
): ProbeOutcome | undefined => {
  const beats = heartbeats.toSorted((a, b) => a.writtenAt - b.writtenAt);
  const first = beats[0];
  const last = beats.at(-1);

  if (first === undefined || last === undefined) {
    return undefined;
  }

  const pageLoads = new Set(beats.map(({ pageLoadId }) => pageLoadId)).size;
  const longestGapMs = beats.reduce(
    (longest, beat, index) =>
      index === 0 ? 0 : Math.max(longest, beat.writtenAt - (beats[index - 1]?.writtenAt ?? 0)),
    0,
  );
  const base = {
    runId: first.runId,
    strategy: first.strategy,
    holdMs: first.holdMs,
    startedAt: first.writtenAt,
    lastSeenMs: last.elapsedMs,
    longestGapMs,
    pageLoads,
  };

  if (last.elapsedMs >= last.holdMs) {
    return { ...base, state: pageLoads > 1 ? "resumed" : "completed" };
  }

  return { ...base, state: now - last.writtenAt > PROBE_SILENCE_LIMIT_MS ? "stopped" : "running" };
};

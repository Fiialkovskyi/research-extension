import * as v from "valibot";

import type { StoredHeartbeat, StoredJob } from "@/shared/storage";

import { PROBE_HEARTBEAT_INTERVAL_MS } from "../../constants";
import { probeCheckpointSchema, probeJobPayloadSchema } from "../../schemas";
import type { LifetimeStrategy, ProbeCheckpoint } from "../../types";
import { buildHeartbeat } from "../buildHeartbeat";

/** What a probe run needs from the background that runs it. */
export interface RunLifetimeProbeOptions {
  /** The claimed probe job. */
  job: StoredJob;
  /** Identifies this load of the background page. */
  pageLoadId: string;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  writeHeartbeat: (heartbeat: StoredHeartbeat) => Promise<void>;
  saveCheckpoint: (checkpoint: ProbeCheckpoint) => Promise<void>;
  /**
   * Starts the strategy's keep-alive and returns its release, or nothing for a
   * strategy that has none.
   */
  holdFor: (strategy: LifetimeStrategy) => (() => void) | undefined;
}

/**
 * Runs one background-lifetime probe (spike M0-1): holds the background busy
 * for the run's hold, writing a heartbeat and a checkpoint every
 * {@link PROBE_HEARTBEAT_INTERVAL_MS}, under the run's keep-alive strategy.
 *
 * A run handed back after an unload is a resumed run. Only `wakeAndResume`
 * carries on from its checkpoint; every other strategy has already failed by
 * then, so it ends where its beats stopped instead of hiding the unload.
 *
 * @throws When the job's payload or checkpoint is not a probe's.
 */
export const runLifetimeProbe = async (options: RunLifetimeProbeOptions): Promise<void> => {
  const { job, pageLoadId, now, sleep } = options;
  const payload = v.parse(probeJobPayloadSchema, job.payload);
  const checkpoint =
    job.checkpoint === undefined ? undefined : v.parse(probeCheckpointSchema, job.checkpoint);
  const isResumed = checkpoint !== undefined && checkpoint.pageLoadId !== pageLoadId;

  if (isResumed && payload.strategy !== "wakeAndResume") {
    return;
  }

  const source = { ...payload, pageLoadId };
  // As if the run had started here: elapsed time carries on from the checkpoint.
  const startedAt = now() - (checkpoint?.elapsedMs ?? 0);
  const release = options.holdFor(payload.strategy);

  try {
    for (;;) {
      const elapsedMs = Math.min(now() - startedAt, payload.holdMs);

      await options.writeHeartbeat(buildHeartbeat(source, elapsedMs, now()));
      await options.saveCheckpoint({ elapsedMs, pageLoadId });

      if (elapsedMs >= payload.holdMs) {
        return;
      }

      await sleep(Math.min(PROBE_HEARTBEAT_INTERVAL_MS, payload.holdMs - elapsedMs));
    }
  } finally {
    release?.();
  }
};

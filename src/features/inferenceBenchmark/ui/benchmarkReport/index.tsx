import { MINIMUM_CHUNKS_PER_SECOND } from "../../constants";
import type { ThroughputMeasurement } from "../../model/measureEmbeddingThroughput";

export interface BenchmarkReportProps {
  measurement?: ThroughputMeasurement;
  /** Threads the runtime used, which decides how to read the number. */
  threadCount?: number;
  isRunning?: boolean;
}

const getThreadLabel = (threadCount: number | undefined): string | null => {
  if (threadCount === undefined) {
    return null;
  }

  return threadCount === 1 ? ", single-threaded" : `, ${threadCount} threads`;
};

/**
 * Reports a measurement against the budget it is judged by.
 *
 * Shows the device and thread count beside the number, because the number means
 * different things depending on them: a figure from the accelerated path says
 * nothing about the platform this add-on declares as its minimum, where no such
 * path exists. A report that omitted them would invite exactly the wrong
 * conclusion.
 */
export function BenchmarkReport({ measurement, threadCount, isRunning }: BenchmarkReportProps) {
  if (isRunning === true) {
    return (
      <p data-testid="benchmark-running" className="text-sm text-slate-700 dark:text-slate-300">
        Measuring…
      </p>
    );
  }

  if (measurement === undefined) {
    return null;
  }

  const threadLabel = getThreadLabel(threadCount);
  const verdict = measurement.meetsBudget
    ? { text: "meets the budget", className: "text-emerald-700 dark:text-emerald-400" }
    : { text: "below the budget", className: "text-red-700 dark:text-red-400" };

  return (
    <dl
      data-testid="benchmark-report"
      className="grid grid-cols-[auto_1fr] gap-x-3 text-xs text-slate-600 dark:text-slate-400"
    >
      <dt>Throughput</dt>
      <dd>
        <span className="font-medium">{measurement.chunksPerSecond.toFixed(1)} chunks/s</span>{" "}
        <span className={verdict.className}>
          ({verdict.text} of {MINIMUM_CHUNKS_PER_SECOND})
        </span>
      </dd>
      <dt>Device</dt>
      <dd>
        {measurement.device}
        {threadLabel}
      </dd>
      <dt>Batch</dt>
      <dd>
        {measurement.chunkCount} chunks in {(measurement.durationMs / 1000).toFixed(2)} s
      </dd>
      <dt>Load</dt>
      <dd>{(measurement.loadDurationMs / 1000).toFixed(2)} s, paid once</dd>
    </dl>
  );
}

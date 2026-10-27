import { METRIC_LABELS } from "../../constants";
import type { Metrics } from "../../types";

/**
 * The mean of several runs' numbers, each over the runs that had it: a model
 * answers a little differently each time, and the mean is steadier than any one run.
 */
export const averageMetrics = (runs: readonly Metrics[]): Metrics => {
  const mean = (name: keyof Metrics): number | null => {
    const values = runs.flatMap((run) => run[name] ?? []);

    return values.length === 0
      ? null
      : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 1000) / 1000;
  };

  return Object.fromEntries(
    (Object.keys(METRIC_LABELS) as (keyof Metrics)[]).map((name) => [name, mean(name)]),
  ) as Metrics;
};

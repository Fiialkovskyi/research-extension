import { METRIC_LABELS } from "../../constants";
import type { Baseline, Metrics } from "../../types";

/** The metrics that are not shares of something, shown as plain numbers. */
const COUNT_METRICS: ReadonlySet<keyof Metrics> = new Set([
  "cardCount",
  "durationSeconds",
  "requestCount",
]);

const formatValue = (name: keyof Metrics, value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "–";
  }

  return COUNT_METRICS.has(name) ? String(value) : `${(value * 100).toFixed(1)}%`;
};

/** The change from the baseline: percentage points for a share, the plain difference for a count. */
const formatDifference = (
  name: keyof Metrics,
  value: number | null,
  baseline: number | null | undefined,
): string => {
  if (value === null || baseline === null || baseline === undefined) {
    return "";
  }

  const difference = COUNT_METRICS.has(name) ? value - baseline : (value - baseline) * 100;
  const rounded = Math.round(difference * 10) / 10;
  const text = COUNT_METRICS.has(name) ? String(rounded) : `${rounded} pts`;

  return rounded > 0 ? `+${text}` : rounded < 0 ? `−${text.replace("-", "")}` : "±0";
};

/**
 * Lays a run's numbers out as a table, each beside its value in the baseline
 * and the difference. Without a baseline, or for a number it lacks, only the
 * run's own value is shown.
 */
export const formatReport = (metrics: Metrics, baseline?: Baseline): string => {
  const names = Object.keys(METRIC_LABELS) as (keyof Metrics)[];
  const width = Math.max(...names.map((name) => METRIC_LABELS[name].length));
  const rows = names.map((name) => {
    const value = metrics[name];
    const earlier = baseline?.[name];
    const cells = [
      METRIC_LABELS[name].padEnd(width),
      formatValue(name, value).padStart(8),
      (baseline === undefined ? "" : formatValue(name, earlier)).padStart(8),
      formatDifference(name, value, earlier),
    ];

    return cells.join("  ").trimEnd();
  });
  const header = ["".padEnd(width), "this run".padStart(8), "baseline".padStart(8)].join("  ");

  return [baseline === undefined ? header.replace("  baseline", "") : header, ...rows].join("\n");
};

import { WORK_LABELS } from "../../constants";

/**
 * Names a kind of background work the way the user would, or `undefined` for
 * work they would not recognize (diagnostics, or a type this build does not
 * know), which the strip then leaves out of every count.
 */
export const getWorkLabel = (type: string): string | undefined =>
  Object.hasOwn(WORK_LABELS, type) ? WORK_LABELS[type] : undefined;

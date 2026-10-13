import type { StoredSummary } from "@/shared/storage";

/**
 * Whether a summary no longer matches what was read (REQ-LIN-006): its
 * cluster's facts are not the set it was built from — one was added or
 * removed, or a page changed or was deleted — or the model that wrote it is
 * no longer installed.
 */
export const isSummaryStale = (
  summary: Pick<StoredSummary, "factSetHash" | "modelRef">,
  currentFactSetHash: string,
  installedModelRefs: ReadonlySet<string>,
): boolean =>
  summary.factSetHash !== currentFactSetHash || !installedModelRefs.has(summary.modelRef);

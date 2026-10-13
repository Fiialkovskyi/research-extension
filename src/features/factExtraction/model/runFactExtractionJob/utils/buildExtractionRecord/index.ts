import type { StoredExtraction } from "@/shared/storage";

/**
 * Records a chunk's outcome on a snapshot's extraction and recomputes the
 * totals from every chunk's outcome, so a chunk redone after an unload
 * replaces its earlier outcome instead of adding to it.
 */
export const buildExtractionRecord = (
  record: StoredExtraction,
  chunkIndex: number,
  outcome: StoredExtraction["chunkOutcomes"][number],
): StoredExtraction => {
  const chunkOutcomes = [...record.chunkOutcomes];

  chunkOutcomes[chunkIndex] = outcome;

  const done = chunkOutcomes.filter((entry) => entry !== undefined);

  return {
    ...record,
    chunkOutcomes,
    chunksDone: done.length,
    keptCount: done.reduce((sum, { kept }) => sum + kept, 0),
    droppedCount: done.reduce((sum, { dropped }) => sum + dropped, 0),
    invalidChunkCount: done.filter(({ isInvalid }) => isInvalid).length,
  };
};

import { describe, expect, it } from "vitest";

import { buildExtractionRecord } from ".";
import type { StoredExtraction } from "@/shared/storage";

const EMPTY: StoredExtraction = {
  snapshotId: "snap",
  sessionId: "s",
  nodeId: "n",
  modelRef: "m",
  prompt: "factExtraction@1",
  chunkCount: 3,
  chunkOutcomes: [],
  chunksDone: 0,
  keptCount: 0,
  droppedCount: 0,
  invalidChunkCount: 0,
};

describe("buildExtractionRecord", () => {
  it("adds up the chunks done", () => {
    const first = buildExtractionRecord(EMPTY, 0, { kept: 3, dropped: 1, isInvalid: false });
    const second = buildExtractionRecord(first, 1, { kept: 0, dropped: 0, isInvalid: true });

    expect(second).toMatchObject({
      chunksDone: 2,
      keptCount: 3,
      droppedCount: 1,
      invalidChunkCount: 1,
    });
  });

  it("replaces a redone chunk's outcome rather than counting it twice", () => {
    const first = buildExtractionRecord(EMPTY, 0, { kept: 3, dropped: 1, isInvalid: false });
    const redone = buildExtractionRecord(first, 0, { kept: 2, dropped: 2, isInvalid: false });

    expect(redone).toMatchObject({ chunksDone: 1, keptCount: 2, droppedCount: 2 });
  });
});

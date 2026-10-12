import * as v from "valibot";

/** What an `embedSnapshot` job carries beyond its identity. */
export const embedSnapshotPayloadSchema = v.object({
  snapshotId: v.string(),
  spaceId: v.string(),
});

/** How far an `embedSnapshot` job got: the first part not yet embedded. */
export const embedSnapshotCheckpointSchema = v.object({
  nextPart: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

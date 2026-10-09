import * as v from "valibot";

/**
 * One entry of the hub's file listing, as far as we rely on it.
 *
 * `oid` is the git object hash of the file's contents. `lfs.oid` is present
 * only for files held in large-file storage — in practice the model weights —
 * and is a SHA-256.
 */
const treeEntrySchema = v.object({
  type: v.string(),
  path: v.pipe(v.string(), v.minLength(1)),
  size: v.pipe(v.number(), v.integer(), v.minValue(0)),
  oid: v.optional(v.pipe(v.string(), v.regex(/^[0-9a-f]{40}$/))),
  lfs: v.optional(
    v.object({
      oid: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
    }),
  ),
});

export const treeSchema = v.array(treeEntrySchema);

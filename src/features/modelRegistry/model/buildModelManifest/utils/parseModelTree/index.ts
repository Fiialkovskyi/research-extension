import * as v from "valibot";

import type { FileDigest } from "@/shared/modelManifest";

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

const treeSchema = v.array(treeEntrySchema);

/** What the listing says about one file: how big it is and how to verify it. */
export interface TreeFile {
  digest: FileDigest;
  bytes: number;
}

/**
 * Reads the hub's file listing into a lookup from path to digest and size.
 *
 * The strongest digest each file actually has is used: a SHA-256 for the
 * weights, and the git object hash for the small configuration files, which
 * large-file storage does not hold. A file the listing cannot describe either
 * way is left out, so the caller fails on a missing entry rather than
 * installing something it cannot verify.
 *
 * @throws when the listing is not a listing at all.
 */
export const parseModelTree = (tree: unknown): Map<string, TreeFile> => {
  const parsed = v.safeParse(treeSchema, tree);

  if (!parsed.success) {
    throw new Error("The hub's file listing could not be read.");
  }

  const files = new Map<string, TreeFile>();

  for (const entry of parsed.output) {
    if (entry.type !== "file") {
      continue;
    }

    const digest: FileDigest | undefined =
      entry.lfs !== undefined
        ? { algorithm: "sha256", value: entry.lfs.oid }
        : entry.oid !== undefined
          ? { algorithm: "git-blob-sha1", value: entry.oid }
          : undefined;

    if (digest === undefined) {
      continue;
    }

    files.set(entry.path, { digest, bytes: entry.size });
  }

  return files;
};

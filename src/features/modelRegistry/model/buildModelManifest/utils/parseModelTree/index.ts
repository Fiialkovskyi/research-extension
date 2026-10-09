import * as v from "valibot";

import type { FileDigest } from "@/shared/modelManifest";
import { treeSchema } from "./schemas";

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

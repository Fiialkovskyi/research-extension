import type { FileDigest } from "@/shared/modelManifest";
import { getFileDigest } from "./utils/getFileDigest";

/**
 * Checks a downloaded file against the digest its manifest records.
 *
 * Called before anything is stored, so bytes that do not match what the
 * manifest describes never reach disk and never reach the runtime. The error
 * names the file and both digests, because the difference between "the
 * download was corrupted" and "this is not the file the commit describes"
 * matters to whoever reads the failure.
 *
 * @throws when the computed digest differs from the expected one.
 */
export const assertFileDigest = async (
  path: string,
  contents: ArrayBuffer,
  expected: FileDigest,
): Promise<void> => {
  const actual = await getFileDigest(contents, expected.algorithm);

  if (actual !== expected.value) {
    throw new Error(
      `"${path}" does not match its manifest: expected ${expected.algorithm} ` +
        `${expected.value}, computed ${actual}.`,
    );
  }
};

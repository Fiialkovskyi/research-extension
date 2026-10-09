import type { FileDigest } from "@/shared/modelManifest";

const HEX_BY_BYTE = Array.from({ length: 256 }, (_unused, byte) =>
  byte.toString(16).padStart(2, "0"),
);

const toHex = (digest: ArrayBuffer): string => {
  let hex = "";

  for (const byte of new Uint8Array(digest)) {
    hex += HEX_BY_BYTE[byte];
  }

  return hex;
};

/**
 * Computes a file's digest under the algorithm its manifest entry names.
 *
 * The git object hash is not a plain hash of the contents: git hashes
 * `blob <byte length>\0` followed by the bytes, and the hub publishes exactly
 * that value as a file's `oid`. Reproducing the framing is what lets a small
 * configuration file — for which the hub publishes no SHA-256 — still be
 * checked against something the hub actually said.
 */
export const getFileDigest = async (
  contents: ArrayBuffer,
  algorithm: FileDigest["algorithm"],
): Promise<string> => {
  if (algorithm === "sha256") {
    // Digested through a view rather than the buffer itself: a buffer created
    // in another realm fails the platform's instance check, and a view is
    // accepted everywhere a buffer is.
    return toHex(await crypto.subtle.digest("SHA-256", new Uint8Array(contents)));
  }

  const header = new TextEncoder().encode(`blob ${contents.byteLength}\0`);
  const framed = new Uint8Array(header.byteLength + contents.byteLength);

  framed.set(header, 0);
  framed.set(new Uint8Array(contents), header.byteLength);

  return toHex(await crypto.subtle.digest("SHA-1", framed));
};

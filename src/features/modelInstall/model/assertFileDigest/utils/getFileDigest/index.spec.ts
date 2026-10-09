import { describe, expect, it } from "vitest";

import { getFileDigest } from ".";

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("getFileDigest", () => {
  it("computes a SHA-256 of the contents", async () => {
    // The published digest of the empty input, which pins the encoding too.
    expect(await getFileDigest(new ArrayBuffer(0), "sha256")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("frames a git object hash the way git does", async () => {
    // `git hash-object` of a file holding exactly "hello", which is also what
    // the hub publishes as that file's oid.
    expect(await getFileDigest(encode("hello"), "git-blob-sha1")).toBe(
      "b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0",
    );
  });

  it("hashes the empty blob to git's documented value", async () => {
    expect(await getFileDigest(new ArrayBuffer(0), "git-blob-sha1")).toBe(
      "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
    );
  });

  it("produces lowercase hexadecimal, matching what the hub publishes", async () => {
    expect(await getFileDigest(encode("abc"), "sha256")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a 40-character git object hash", async () => {
    expect(await getFileDigest(encode("abc"), "git-blob-sha1")).toMatch(/^[0-9a-f]{40}$/);
  });

  it("gives different contents different digests", async () => {
    const [first, second] = await Promise.all([
      getFileDigest(encode("a"), "sha256"),
      getFileDigest(encode("b"), "sha256"),
    ]);

    expect(first).not.toBe(second);
  });

  it("distinguishes contents that differ only in length framing", async () => {
    // Without the length header, "blob" framing would collide across sizes.
    const [short, long] = await Promise.all([
      getFileDigest(encode("aa"), "git-blob-sha1"),
      getFileDigest(encode("aaa"), "git-blob-sha1"),
    ]);

    expect(short).not.toBe(long);
  });
});

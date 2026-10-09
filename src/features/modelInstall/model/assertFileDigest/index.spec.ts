import { describe, expect, it } from "vitest";

import { assertFileDigest } from ".";
import { getFileDigest } from "./utils/getFileDigest";

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

const emptySha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const emptyGitOid = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";

describe("assertFileDigest", () => {
  it("accepts contents matching a SHA-256", async () => {
    const contents = encode("the weights");
    const value = await getFileDigest(contents, "sha256");

    await expect(
      assertFileDigest("onnx/model.onnx", contents, { algorithm: "sha256", value }),
    ).resolves.toBeUndefined();
  });

  it("accepts contents matching a git object hash", async () => {
    const contents = encode('{"hidden_size":384}');
    const value = await getFileDigest(contents, "git-blob-sha1");

    await expect(
      assertFileDigest("config.json", contents, { algorithm: "git-blob-sha1", value }),
    ).resolves.toBeUndefined();
  });

  it("accepts an empty file whose digest matches", async () => {
    await expect(
      assertFileDigest("empty", new ArrayBuffer(0), { algorithm: "sha256", value: emptySha256 }),
    ).resolves.toBeUndefined();

    await expect(
      assertFileDigest("empty", new ArrayBuffer(0), {
        algorithm: "git-blob-sha1",
        value: emptyGitOid,
      }),
    ).resolves.toBeUndefined();
  });

  it("refuses contents that do not match", async () => {
    await expect(
      assertFileDigest("onnx/model.onnx", encode("tampered"), {
        algorithm: "sha256",
        value: "0".repeat(64),
      }),
    ).rejects.toThrow(/does not match its manifest/);
  });

  it("refuses an empty file where contents were expected", async () => {
    // A truncated download is the common case, and it must not pass.
    await expect(
      assertFileDigest("onnx/model.onnx", new ArrayBuffer(0), {
        algorithm: "sha256",
        value: await getFileDigest(encode("the weights"), "sha256"),
      }),
    ).rejects.toThrow(/does not match/);
  });

  it("names the file, the algorithm and both digests in the failure", async () => {
    const promise = assertFileDigest("onnx/model.onnx", encode("tampered"), {
      algorithm: "sha256",
      value: "0".repeat(64),
    });

    await expect(promise).rejects.toThrow(/onnx\/model\.onnx/);
    await expect(promise).rejects.toThrow(/sha256/);
    await expect(promise).rejects.toThrow(new RegExp("0".repeat(64)));
  });

  it("does not accept a digest computed under the other algorithm", async () => {
    const contents = encode("the weights");

    await expect(
      assertFileDigest("onnx/model.onnx", contents, {
        algorithm: "sha256",
        // A correct value, but for the wrong algorithm.
        value: (await getFileDigest(contents, "git-blob-sha1")).padEnd(64, "0"),
      }),
    ).rejects.toThrow(/does not match/);
  });
});

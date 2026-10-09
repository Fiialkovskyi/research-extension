import { describe, expect, it } from "vitest";

import { parseModelTree } from ".";

const sha256 = "a".repeat(64);
const gitOid = "b".repeat(40);

const weights = {
  type: "file",
  path: "onnx/model_quantized.onnx",
  size: 22_972_370,
  oid: gitOid,
  lfs: { oid: sha256 },
};
const config = { type: "file", path: "config.json", size: 650, oid: gitOid };

describe("parseModelTree", () => {
  it("takes the SHA-256 from large-file storage for the weights", () => {
    expect(parseModelTree([weights]).get("onnx/model_quantized.onnx")).toEqual({
      digest: { algorithm: "sha256", value: sha256 },
      bytes: 22_972_370,
    });
  });

  it("falls back to the git object hash for a file storage does not hold", () => {
    expect(parseModelTree([config]).get("config.json")).toEqual({
      digest: { algorithm: "git-blob-sha1", value: gitOid },
      bytes: 650,
    });
  });

  it("prefers the stronger digest when a file has both", () => {
    const digest = parseModelTree([weights]).get("onnx/model_quantized.onnx")?.digest;

    expect(digest?.algorithm).toBe("sha256");
  });

  it("skips directories, which have nothing to verify", () => {
    const files = parseModelTree([{ type: "directory", path: "onnx", size: 0 }, config]);

    expect([...files.keys()]).toEqual(["config.json"]);
  });

  it("leaves out a file it could not describe, so the caller fails on it later", () => {
    const files = parseModelTree([{ type: "file", path: "mystery.bin", size: 10 }, config]);

    expect(files.has("mystery.bin")).toBe(false);
    expect(files.has("config.json")).toBe(true);
  });

  it("reads an empty listing as no files rather than an error", () => {
    expect(parseModelTree([]).size).toBe(0);
  });

  it.each([
    ["an object", {}],
    ["a string", "tree"],
    ["null", null],
    ["an entry missing its path", [{ type: "file", size: 1 }]],
    ["an entry with a malformed digest", [{ type: "file", path: "a", size: 1, oid: "short" }]],
  ])("refuses %s", (_label, tree) => {
    expect(() => parseModelTree(tree)).toThrow(/could not be read/);
  });
});

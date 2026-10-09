import { describe, expect, it } from "vitest";

import { getHuggingFaceFileUrl } from ".";
import { HUGGING_FACE_ORIGIN, MODEL_HOST_ORIGINS } from "../constants";
import type { ModelReference } from "@/shared/modelManifest";

const commit = "751bff37182d3f1213fa05d7196b954e230abad9";

const reference: ModelReference = {
  hub: "huggingface",
  repository: "Xenova/all-MiniLM-L6-v2",
  revision: commit,
};

describe("getHuggingFaceFileUrl", () => {
  it("addresses a file at the pinned commit", () => {
    expect(getHuggingFaceFileUrl(reference, "config.json")).toBe(
      `${HUGGING_FACE_ORIGIN}/Xenova/all-MiniLM-L6-v2/resolve/${commit}/config.json`,
    );
  });

  it("keeps a nested path, which weight files always have", () => {
    expect(getHuggingFaceFileUrl(reference, "onnx/model_quantized.onnx")).toBe(
      `${HUGGING_FACE_ORIGIN}/Xenova/all-MiniLM-L6-v2/resolve/${commit}/onnx/model_quantized.onnx`,
    );
  });

  it.each([["gpt2"], ["a/b/c"]])(
    "refuses a repository that is not owner/name: %s",
    (repository) => {
      expect(() => getHuggingFaceFileUrl({ ...reference, repository }, "config.json")).toThrow(
        /owner\/name/,
      );
    },
  );

  it.each([
    ["a branch", "main"],
    ["a tag", "v1.0"],
    ["a short commit", commit.slice(0, 7)],
    ["an empty revision", ""],
  ])("refuses %s, so the bytes cannot depend on when they were fetched", (_label, revision) => {
    expect(() => getHuggingFaceFileUrl({ ...reference, revision }, "config.json")).toThrow(
      /must name a commit/,
    );
  });

  it("refuses a path that would climb out of the repository", () => {
    expect(() => getHuggingFaceFileUrl(reference, "../../../etc/passwd")).toThrow(/relative/);
  });

  it("escapes a path segment that would start a query", () => {
    expect(new URL(getHuggingFaceFileUrl(reference, "model.onnx?raw=1")).search).toBe("");
  });

  it("stays on a permitted origin", () => {
    const { origin } = new URL(getHuggingFaceFileUrl(reference, "config.json"));

    expect(MODEL_HOST_ORIGINS).toContain(origin);
  });
});

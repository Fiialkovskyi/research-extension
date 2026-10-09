import { describe, expect, it } from "vitest";

import { parseHubFileUrl } from ".";
import { HUGGING_FACE_ORIGIN } from "../constants";

const commit = "751bff37182d3f1213fa05d7196b954e230abad9";

describe("parseHubFileUrl", () => {
  it("takes apart a pinned file url", () => {
    expect(
      parseHubFileUrl(
        `${HUGGING_FACE_ORIGIN}/Xenova/all-MiniLM-L6-v2/resolve/${commit}/config.json`,
      ),
    ).toEqual({
      repository: "Xenova/all-MiniLM-L6-v2",
      revision: commit,
      path: "config.json",
    });
  });

  it("keeps a nested path together", () => {
    expect(
      parseHubFileUrl(`${HUGGING_FACE_ORIGIN}/owner/model/resolve/${commit}/onnx/model_q8.onnx`)
        ?.path,
    ).toBe("onnx/model_q8.onnx");
  });

  it("reports a branch name as the revision it was asked for", () => {
    // The runtime asks for `main` even when given a commit, so this has to be
    // reported rather than assumed to be a commit.
    expect(
      parseHubFileUrl(`${HUGGING_FACE_ORIGIN}/owner/model/resolve/main/config.json`)?.revision,
    ).toBe("main");
  });

  it("decodes escaped segments, since both forms name one file", () => {
    expect(
      parseHubFileUrl(`${HUGGING_FACE_ORIGIN}/owner/model/resolve/${commit}/onnx%2Fmodel.onnx`)
        ?.path,
    ).toBe("onnx/model.onnx");
  });

  it.each([
    ["a local path the runtime probes first", "/models/owner/model/config.json"],
    ["another origin", "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.wasm"],
    ["a hub url that is not a file request", `${HUGGING_FACE_ORIGIN}/api/models/owner/model`],
    ["a hub url missing its path", `${HUGGING_FACE_ORIGIN}/owner/model/resolve/${commit}`],
    ["a malformed percent escape", `${HUGGING_FACE_ORIGIN}/owner/model/resolve/main/a%E0%A4%A`],
    ["a path with empty segments", `${HUGGING_FACE_ORIGIN}//owner//model/resolve/main/config.json`],
    ["a repository without an owner", `${HUGGING_FACE_ORIGIN}/gpt2/resolve/main/config.json`],
    ["nonsense", "not a url at all"],
    ["an empty string", ""],
  ])("reports %s as not a hub file request", (_label, request) => {
    expect(parseHubFileUrl(request)).toBeUndefined();
  });

  it("distinguishes two repositories", () => {
    const first = parseHubFileUrl(`${HUGGING_FACE_ORIGIN}/a/one/resolve/main/config.json`);
    const second = parseHubFileUrl(`${HUGGING_FACE_ORIGIN}/b/two/resolve/main/config.json`);

    expect(first?.repository).not.toBe(second?.repository);
  });
});

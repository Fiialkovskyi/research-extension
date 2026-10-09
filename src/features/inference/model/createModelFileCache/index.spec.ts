import { describe, expect, it } from "vitest";

import { createModelFileCache } from ".";
import { getHuggingFaceFileUrl } from "@/shared/huggingFace";
import type { ModelReference } from "@/shared/modelManifest";

const reference: ModelReference = {
  hub: "huggingface",
  repository: "Xenova/all-MiniLM-L6-v2",
  revision: "751bff37182d3f1213fa05d7196b954e230abad9",
};

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

const files = [
  { path: "config.json", contents: encode('{"hidden_size":384}') },
  { path: "onnx/model_quantized.onnx", contents: encode("the weights") },
];

const cache = () => createModelFileCache(reference, files);
const urlFor = (path: string) => getHuggingFaceFileUrl(reference, path);

describe("createModelFileCache", () => {
  it("serves a file under the url the library resolves it to", async () => {
    const response = await cache().match(urlFor("config.json"));

    expect(await response?.text()).toBe('{"hidden_size":384}');
  });

  it("serves a nested weight file", async () => {
    const response = await cache().match(urlFor("onnx/model_quantized.onnx"));

    expect(await response?.text()).toBe("the weights");
  });

  it("labels json so the library's parser accepts it", async () => {
    const response = await cache().match(urlFor("config.json"));

    expect(response?.headers.get("content-type")).toBe("application/json");
  });

  it("labels weights as bytes rather than guessing a text type", async () => {
    const response = await cache().match(urlFor("onnx/model_quantized.onnx"));

    expect(response?.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("misses on the local-path key the library probes first", async () => {
    // Ordinary, not an error: the library tries a local path before the URL.
    expect(await cache().match("/models/Xenova/all-MiniLM-L6-v2/config.json")).toBeUndefined();
  });

  it("misses on a file that was not installed", async () => {
    expect(await cache().match(urlFor("tokenizer.json"))).toBeUndefined();
  });

  it("serves a file asked for under another revision, including a branch name", async () => {
    // Not laxity: the runtime asks for `resolve/main/…` even when handed a
    // pinned commit, so a cache keyed on the commit would never match. This
    // cache holds one model's already-verified files and no others, so there is
    // no second revision it could serve by mistake.
    const asBranch = `https://huggingface.co/${reference.repository}/resolve/main/config.json`;

    expect(await (await cache().match(asBranch))?.text()).toBe('{"hidden_size":384}');
  });

  it("misses on the same file in another repository", async () => {
    const otherRepository = { ...reference, repository: "Xenova/bge-small-en-v1.5" };

    expect(
      await cache().match(getHuggingFaceFileUrl(otherRepository, "config.json")),
    ).toBeUndefined();
  });

  it("records what it was asked for and could not serve", async () => {
    const instance = cache();

    await instance.match("/models/Xenova/all-MiniLM-L6-v2/config.json");

    expect(instance.misses).toContain("/models/Xenova/all-MiniLM-L6-v2/config.json");
  });

  it("reports the paths it holds, for comparison against what was asked", () => {
    expect(cache().keys).toEqual(["config.json", "onnx/model_quantized.onnx"]);
  });

  it("refuses to store anything, so unverified bytes cannot join verified ones", async () => {
    const instance = cache();

    await instance.put(urlFor("tokenizer.json"));

    expect(await instance.match(urlFor("tokenizer.json"))).toBeUndefined();
  });

  it("can be read twice, so a reloaded model does not consume its own files", async () => {
    const instance = cache();

    expect(await (await instance.match(urlFor("config.json")))?.text()).toBe('{"hidden_size":384}');
    expect(await (await instance.match(urlFor("config.json")))?.text()).toBe('{"hidden_size":384}');
  });

  it("serves nothing when no files were provided", async () => {
    expect(await createModelFileCache(reference, []).match(urlFor("config.json"))).toBeUndefined();
  });
});

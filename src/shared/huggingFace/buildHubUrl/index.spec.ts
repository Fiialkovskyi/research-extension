import { describe, expect, it } from "vitest";

import { buildHubUrl } from ".";
import { HUGGING_FACE_ORIGIN, MODEL_HOST_ORIGINS } from "../constants";

describe("buildHubUrl", () => {
  it("joins segments under the given path", () => {
    expect(buildHubUrl("/api/models/", ["owner", "model"])).toBe(
      `${HUGGING_FACE_ORIGIN}/api/models/owner/model`,
    );
  });

  it("keeps the separators between segments, which hub paths depend on", () => {
    expect(buildHubUrl("/", ["owner", "model", "resolve", "abc", "onnx", "model.onnx"])).toBe(
      `${HUGGING_FACE_ORIGIN}/owner/model/resolve/abc/onnx/model.onnx`,
    );
  });

  it("escapes a character that would otherwise start a query", () => {
    const url = buildHubUrl("/api/models/", ["owner", "model?a=1"]);

    expect(new URL(url).search).toBe("");
  });

  it("escapes a character that would otherwise start a fragment", () => {
    expect(new URL(buildHubUrl("/api/models/", ["owner", "model#x"])).hash).toBe("");
  });

  it("escapes a space rather than producing an invalid url", () => {
    expect(buildHubUrl("/api/models/", ["owner", "my model"])).toContain("my%20model");
  });

  it.each([
    ["a parent-directory segment", ["owner", ".."]],
    ["a current-directory segment", ["owner", "."]],
    ["an empty segment", ["owner", "", "model"]],
  ])("refuses %s rather than letting the url resolve elsewhere", (_label, segments) => {
    expect(() => buildHubUrl("/api/models/", segments)).toThrow(/no empty or relative/);
  });

  it("names the offending segment, so the caller can report it", () => {
    expect(() => buildHubUrl("/api/models/", ["owner", ".."])).toThrow(/".."/);
  });

  it("keeps dots that are part of a longer segment", () => {
    expect(buildHubUrl("/", ["model.onnx"])).toBe(`${HUGGING_FACE_ORIGIN}/model.onnx`);
  });

  it("stays on a permitted origin", () => {
    expect(MODEL_HOST_ORIGINS).toContain(new URL(buildHubUrl("/", ["a"])).origin);
  });
});

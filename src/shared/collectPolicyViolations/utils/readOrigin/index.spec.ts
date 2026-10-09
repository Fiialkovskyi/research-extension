import { describe, expect, it } from "vitest";

import { readOrigin } from ".";

describe("readOrigin", () => {
  it("keeps only the origin of a blocked url", () => {
    expect(readOrigin("https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.wasm")).toBe(
      "https://cdn.jsdelivr.net",
    );
  });

  it("drops the path, query and fragment", () => {
    expect(readOrigin("https://example.com/a?b=1#c")).toBe("https://example.com");
  });

  it("keeps a port, since it is part of the origin", () => {
    expect(readOrigin("http://127.0.0.1:3100/popup.html")).toBe("http://127.0.0.1:3100");
  });

  it.each([
    ["the inline keyword", "inline"],
    ["an evaluated-script marker", "eval"],
  ])("keeps %s verbatim, because it is not a url at all", (_label, blockedURI) => {
    expect(readOrigin(blockedURI)).toBe(blockedURI);
  });

  it("keeps a blob url verbatim rather than reporting its opaque origin", () => {
    // This is the real shape of a refusal hit while building the add-on: the
    // model runtime tried to import its loader from a blob. Reported as its
    // origin it would read `null` and point nowhere; kept whole it says the
    // blob came from this add-on's own code.
    const blob = "blob:moz-extension://8cf4bf6a-5f3a-4d5a-9f2f-2f0a1ff2ab42/54a0e0de";

    expect(readOrigin(blob)).toBe(blob);
  });

  it.each([
    ["a bare blob scheme", "blob:"],
    ["a data url", "data:text/html,x"],
  ])("keeps %s verbatim for the same reason", (_label, blockedURI) => {
    expect(readOrigin(blockedURI)).toBe(blockedURI);
  });

  it("maps the empty string to itself, which the caller treats as nothing to report", () => {
    expect(readOrigin("")).toBe("");
  });
});

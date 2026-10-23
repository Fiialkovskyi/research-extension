import { describe, expect, it } from "vitest";

import { isOllamaAccessGranted } from ".";

describe("isOllamaAccessGranted", () => {
  it("is granted once the user connected the local server's own origin", () => {
    expect(isOllamaAccessGranted(["<all_urls>", "http://127.0.0.1:11434/*"])).toBe(true);
  });

  it("is granted when the browser lists the origin without its port", () => {
    expect(isOllamaAccessGranted(["<all_urls>", "http://127.0.0.1/*"])).toBe(true);
  });

  it("is not granted by page access alone, though it covers loopback", () => {
    expect(isOllamaAccessGranted(["<all_urls>", "https://huggingface.co/*"])).toBe(false);
  });

  it("is not granted with nothing granted", () => {
    expect(isOllamaAccessGranted([])).toBe(false);
  });
});

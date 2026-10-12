import { describe, expect, it } from "vitest";

import { isCapturableUrl } from ".";

describe("isCapturableUrl", () => {
  it.each(["https://example.org/a", "http://127.0.0.1:8080/b.html"])("captures %s", (url) => {
    expect(isCapturableUrl(url)).toBe(true);
  });

  it.each([
    "about:newtab",
    "about:blank",
    "moz-extension://uuid/popup.html",
    "file:///Users/me/notes.html",
    "data:text/html,<p>hi</p>",
    "not a url",
    undefined,
  ])("never captures %s", (url) => {
    expect(isCapturableUrl(url)).toBe(false);
  });
});

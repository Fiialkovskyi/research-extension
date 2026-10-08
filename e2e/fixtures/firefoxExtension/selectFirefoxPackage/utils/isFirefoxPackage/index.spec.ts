import { describe, expect, it } from "vitest";

import { isFirefoxPackage } from "./index";

describe("isFirefoxPackage", () => {
  it("recognises the packaged extension", () => {
    expect(isFirefoxPackage("research-graph-extension-0.1.0-firefox.zip")).toBe(true);
  });

  it("ignores the sources archive WXT writes beside it for AMO review", () => {
    expect(isFirefoxPackage("research-graph-extension-0.1.0-sources.zip")).toBe(false);
  });

  it("ignores an unpacked build directory of the same name", () => {
    expect(isFirefoxPackage("firefox-mv3")).toBe(false);
  });

  it("ignores a Chrome package, for when that target is added", () => {
    expect(isFirefoxPackage("research-graph-extension-0.1.0-chrome.zip")).toBe(false);
  });

  it("ignores the sources archive even when the project name itself contains 'firefox'", () => {
    expect(isFirefoxPackage("my-firefox-extension-0.1.0-sources.zip")).toBe(false);
    expect(isFirefoxPackage("my-firefox-extension-0.1.0-firefox.zip")).toBe(true);
  });
});

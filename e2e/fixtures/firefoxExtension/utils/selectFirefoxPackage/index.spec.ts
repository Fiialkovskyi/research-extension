import { describe, expect, it } from "vitest";

import { selectFirefoxPackage } from "./index";

const DIRECTORY = "/tmp/output";

describe("selectFirefoxPackage", () => {
  it("returns the one package, ignoring everything else in the directory", () => {
    const entries = [
      "firefox-mv3",
      "research-graph-extension-0.1.0-sources.zip",
      "research-graph-extension-0.1.0-firefox.zip",
    ];

    expect(selectFirefoxPackage(entries, DIRECTORY)).toBe(
      "research-graph-extension-0.1.0-firefox.zip",
    );
  });

  it("survives a version bump, since it matches a pattern and not a filename", () => {
    expect(selectFirefoxPackage(["research-graph-extension-9.9.9-firefox.zip"], DIRECTORY)).toBe(
      "research-graph-extension-9.9.9-firefox.zip",
    );
  });

  it("explains how to build when nothing is packaged yet", () => {
    expect(() => selectFirefoxPackage(["firefox-mv3"], DIRECTORY)).toThrow(
      /No Firefox package found .* Run "npm run zip:firefox"/s,
    );
  });

  it("refuses to guess between stale builds, and names them", () => {
    const entries = ["app-0.1.0-firefox.zip", "app-0.2.0-firefox.zip"];

    expect(() => selectFirefoxPackage(entries, DIRECTORY)).toThrow(
      /found 2: app-0\.1\.0-firefox\.zip, app-0\.2\.0-firefox\.zip/,
    );
  });

  it("names the directory it searched, so the message is actionable", () => {
    expect(() => selectFirefoxPackage([], "/somewhere/.output")).toThrow(/\/somewhere\/\.output/);
  });
});

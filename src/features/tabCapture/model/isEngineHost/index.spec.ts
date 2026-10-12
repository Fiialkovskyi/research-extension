import { describe, expect, it } from "vitest";

import { isEngineHost } from ".";

describe("isEngineHost", () => {
  it("matches a plain host exactly", () => {
    expect(isEngineHost("bing.com", "bing.com")).toBe(true);
    expect(isEngineHost("www.bing.com", "bing.com")).toBe(false);
  });

  it.each(["google.com", "google.de", "google.co.uk"])(
    "accepts %s under a wildcard top-level domain",
    (hostname) => {
      expect(isEngineHost(hostname, "google.*")).toBe(true);
    },
  );

  it.each(["google.evil.example.com", "notgoogle.com", "google."])("refuses %s", (hostname) => {
    expect(isEngineHost(hostname, "google.*")).toBe(false);
  });
});

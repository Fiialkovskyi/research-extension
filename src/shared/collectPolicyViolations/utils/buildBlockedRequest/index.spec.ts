import { describe, expect, it } from "vitest";

import { buildBlockedRequest } from ".";

describe("buildBlockedRequest", () => {
  it("records the origin and the directive that refused it", () => {
    expect(
      buildBlockedRequest({
        blockedURI: "https://cdn.jsdelivr.net/npm/ort.wasm",
        violatedDirective: "connect-src",
      }),
    ).toEqual({ origin: "https://cdn.jsdelivr.net", directive: "connect-src" });
  });

  it("names a missing directive rather than dropping the report", () => {
    // The origin alone is still actionable.
    expect(buildBlockedRequest({ blockedURI: "https://example.com/x" })).toEqual({
      origin: "https://example.com",
      directive: "unknown",
    });
  });

  it("keeps an unparseable refusal, such as an inline script", () => {
    expect(buildBlockedRequest({ blockedURI: "inline", violatedDirective: "script-src" })).toEqual({
      origin: "inline",
      directive: "script-src",
    });
  });

  it.each([
    ["an absent blocked uri", {}],
    ["an empty blocked uri", { blockedURI: "" }],
  ])("reports nothing for %s, since there is no host to name", (_label, event) => {
    expect(buildBlockedRequest(event)).toBeUndefined();
  });

  it("reports nothing even when a directive is present but the uri is not", () => {
    expect(buildBlockedRequest({ violatedDirective: "connect-src" })).toBeUndefined();
  });
});

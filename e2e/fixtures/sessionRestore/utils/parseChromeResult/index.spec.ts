import { describe, expect, it } from "vitest";

import { parseChromeResult } from ".";

describe("parseChromeResult", () => {
  it("returns the value of a script that succeeded", () => {
    expect(parseChromeResult(JSON.stringify({ ok: { groupId: 7 } }))).toEqual({ groupId: 7 });
  });

  it("returns null for a script that resolved with nothing", () => {
    expect(parseChromeResult(JSON.stringify({ ok: null }))).toBeNull();
  });

  it("throws Firefox's own message for a script that failed", () => {
    expect(() =>
      parseChromeResult(JSON.stringify({ error: "Error: No group with id: 7" })),
    ).toThrow("No group with id: 7");
  });

  it("rejects an answer that is not a string", () => {
    expect(() => parseChromeResult({ ok: 1 })).toThrow("JSON string");
  });
});

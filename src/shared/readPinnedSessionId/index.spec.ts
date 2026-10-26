import { describe, expect, it } from "vitest";

import { readPinnedSessionId } from ".";

describe("readPinnedSessionId", () => {
  it("reads the session a page was opened for", () => {
    expect(readPinnedSessionId("?session=abc-123")).toBe("abc-123");
  });

  it("is undefined for a page opened without a session", () => {
    expect(readPinnedSessionId("")).toBeUndefined();
    expect(readPinnedSessionId("?other=1")).toBeUndefined();
    expect(readPinnedSessionId("?session=")).toBeUndefined();
  });
});

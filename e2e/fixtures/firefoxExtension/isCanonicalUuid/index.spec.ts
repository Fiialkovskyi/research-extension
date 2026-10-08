import { describe, expect, it } from "vitest";

import { isCanonicalUuid } from "./index";

describe("isCanonicalUuid", () => {
  it("accepts a lowercase canonical UUID", () => {
    expect(isCanonicalUuid("8cf4bf6a-5f3a-4d5a-9f2f-2f0a1ff2ab42")).toBe(true);
  });

  it.each([
    ["uppercase hex", "8CF4BF6A-5F3A-4D5A-9F2F-2F0A1FF2AB42"],
    ["braced form", "{8cf4bf6a-5f3a-4d5a-9f2f-2f0a1ff2ab42}"],
    ["missing a group", "8cf4bf6a-5f3a-4d5a-2f0a1ff2ab42"],
    ["non-hex characters", "zzzzzzzz-5f3a-4d5a-9f2f-2f0a1ff2ab42"],
    ["empty", ""],
  ])("rejects %s, which Firefox would silently ignore", (_label, value) => {
    expect(isCanonicalUuid(value)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { isVariantAttributeKey } from ".";

describe("isVariantAttributeKey", () => {
  it("is true for storage and colour, which a product comes in several of", () => {
    expect(isVariantAttributeKey("storage")).toBe(true);
    expect(isVariantAttributeKey("colour")).toBe(true);
  });

  it("is false for what a product has one of, and for a key nobody listed", () => {
    expect(isVariantAttributeKey("weight")).toBe(false);
    expect(isVariantAttributeKey("fingerprint reader position")).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";

import { isGroupPresent } from ".";

describe("isGroupPresent", () => {
  it("is true when the browser finds the group", async () => {
    expect(await isGroupPresent(vi.fn().mockResolvedValue({ id: 42 }), 42)).toBe(true);
  });

  it("is false when the browser rejects the lookup", async () => {
    expect(
      await isGroupPresent(vi.fn().mockRejectedValue(new Error("No group with id: 42")), 42),
    ).toBe(false);
  });
});

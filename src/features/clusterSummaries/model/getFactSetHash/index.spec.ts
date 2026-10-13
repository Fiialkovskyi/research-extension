import { describe, expect, it } from "vitest";

import { getFactSetHash } from ".";

describe("getFactSetHash", () => {
  it("does not depend on order", async () => {
    expect(await getFactSetHash(["b", "a"])).toBe(await getFactSetHash(["a", "b"]));
  });

  it("differs for another set", async () => {
    expect(await getFactSetHash(["a"])).not.toBe(await getFactSetHash(["a", "b"]));
    expect(await getFactSetHash(["a"])).toMatch(/^[0-9a-f]{64}$/u);
  });
});

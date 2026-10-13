import { describe, expect, it } from "vitest";

import { getFactKey } from ".";

describe("getFactKey", () => {
  it("gives one key for the same value in grams and kilograms", async () => {
    expect(
      await getFactKey({ subject: "Volta E5", attribute: "weight", value: "23.5", unit: "kg" }),
    ).toBe(
      await getFactKey({ subject: "volta e5", attribute: "Weight", value: "23 500", unit: "g" }),
    );
  });

  it("gives one key whatever the case and punctuation of names and text", async () => {
    expect(
      await getFactKey({ subject: 'MacBook Neo 13"', attribute: "colour", value: "Blush" }),
    ).toBe(await getFactKey({ subject: "macbook neo 13", attribute: "Colour", value: "blush" }));
  });

  it("gives two keys for values within 5% of each other", async () => {
    expect(
      await getFactKey({ subject: "x", attribute: "price", value: "1000", unit: "USD" }),
    ).not.toBe(await getFactKey({ subject: "x", attribute: "price", value: "1040", unit: "USD" }));
  });

  it("is a hex SHA-256", async () => {
    expect(await getFactKey({ subject: "x", attribute: "y", value: "z" })).toMatch(
      /^[0-9a-f]{64}$/u,
    );
  });
});

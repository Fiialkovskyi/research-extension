import { describe, expect, it } from "vitest";

import { parsePrice } from ".";

describe("parsePrice", () => {
  it.each([
    ["24399", 24399],
    [24399, 24399],
    ["24 399", 24399],
    ["24399,50", 24399.5],
    ["0.99", 0.99],
  ])("reads %j as %d", (value, price) => {
    expect(parsePrice(value)).toBe(price);
  });

  it.each([
    "call us",
    "",
    "0",
    0,
    -5,
    "-5",
    "1000000000",
    Number.NaN,
    Infinity,
    null,
    undefined,
    {},
  ])("reads %j as no price", (value) => {
    expect(parsePrice(value)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { isQuoteGrounded } from ".";

const CHUNK = "The Volta E5 weighs 23.5 kg.\nThe motor delivers  85 Nm of torque.";

describe("isQuoteGrounded", () => {
  it("grounds a quote copied exactly", () => {
    expect(isQuoteGrounded("weighs 23.5 kg", CHUNK)).toBe(true);
  });

  it("grounds a quote that differs only in whitespace", () => {
    expect(isQuoteGrounded("motor delivers 85 Nm", CHUNK)).toBe(true);
    expect(isQuoteGrounded("23.5 kg. The motor", CHUNK)).toBe(true);
  });

  it("does not ground a quote in another case", () => {
    expect(isQuoteGrounded("the volta e5", CHUNK)).toBe(false);
  });

  it("does not ground a quote the chunk does not contain", () => {
    expect(isQuoteGrounded("weighs 24 kg", CHUNK)).toBe(false);
  });

  it("grounds nothing with an empty quote", () => {
    expect(isQuoteGrounded("", CHUNK)).toBe(false);
    expect(isQuoteGrounded("   ", CHUNK)).toBe(false);
  });
});

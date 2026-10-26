import { describe, expect, it } from "vitest";

import { isNamingProduct } from ".";

describe("isNamingProduct", () => {
  it("recognises the name however case and punctuation fall", () => {
    expect(isNamingProduct("IPHONE-17 costs 45 999 UAH", "iPhone 17")).toBe(true);
  });

  it("recognises a short name for a long one: two words of it in a row", () => {
    expect(
      isNamingProduct("Pixel 10a has a 5100 mAh battery", "Google Pixel 10a 8/256GB (Lavender)"),
    ).toBe(true);
  });

  it("takes the whole of a one-word name, as a word", () => {
    expect(isNamingProduct("The Corsa weighs 19.8 kg", "Corsa")).toBe(true);
    expect(isNamingProduct("Corsairs are ships", "Corsa")).toBe(false);
  });

  it("does not take a statement that says a device for a name", () => {
    expect(isNamingProduct("The device supports video playback", "iPhone 17")).toBe(false);
    expect(isNamingProduct("It weighs 20 kg", "Google Pixel 10a")).toBe(false);
  });

  it("names nothing for an empty name", () => {
    expect(isNamingProduct("Anything", "  ")).toBe(false);
  });
});

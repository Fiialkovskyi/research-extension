import { describe, expect, it } from "vitest";

import { getAttributeKey } from ".";

describe("getAttributeKey", () => {
  it("gives two languages one key", () => {
    expect(getAttributeKey("діафрагма")).toBe(getAttributeKey("aperture"));
    expect(getAttributeKey("Діафрагма камери")).toBe("aperture");
    expect(getAttributeKey("ємність акумулятора")).toBe(getAttributeKey("Battery capacity"));
    expect(getAttributeKey("Аккумулятор")).toBe("battery capacity");
    expect(getAttributeKey("діагональ екрана")).toBe(getAttributeKey("display size"));
    expect(getAttributeKey("Вага")).toBe(getAttributeKey("weight"));
  });

  it("matches an apostrophe however it is written", () => {
    expect(getAttributeKey("Вбудована пам’ять")).toBe("storage");
    expect(getAttributeKey("Вбудована пам'ять")).toBe("storage");
  });

  it("keeps a narrower attribute out of a wider one", () => {
    expect(getAttributeKey("battery life")).toBe("battery life");
    expect(getAttributeKey("battery capacity")).toBe("battery capacity");
    expect(getAttributeKey("front camera")).toBe("front camera");
    expect(getAttributeKey("main camera")).toBe("main camera");
  });

  it("does not take a longer word for a listed one", () => {
    expect(getAttributeKey("software")).toBe("software");
    expect(getAttributeKey("priceless extras")).toBe("priceless extras");
  });

  it("gives an attribute nobody listed its own normalised name", () => {
    expect(getAttributeKey("Fingerprint   reader position")).toBe("fingerprint reader position");
  });
});

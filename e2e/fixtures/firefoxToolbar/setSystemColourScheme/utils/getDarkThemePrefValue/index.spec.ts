import { describe, expect, it } from "vitest";

import { getDarkThemePrefValue } from "./index";

describe("getDarkThemePrefValue", () => {
  it("maps dark onto the integer Firefox treats as dark", () => {
    expect(getDarkThemePrefValue("dark")).toBe(1);
  });

  it("maps light onto the integer Firefox treats as light", () => {
    expect(getDarkThemePrefValue("light")).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import { writeFactValue } from ".";

describe("writeFactValue", () => {
  it("writes the value, then its unit when there is one", () => {
    expect(writeFactValue({ value: "5100", unit: "mAh" })).toBe("5100 mAh");
    expect(writeFactValue({ value: "OLED" })).toBe("OLED");
    expect(writeFactValue({ value: "OLED", unit: " " })).toBe("OLED");
  });
});

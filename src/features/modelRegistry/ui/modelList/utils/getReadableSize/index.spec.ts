import { describe, expect, it } from "vitest";

import { getReadableSize } from ".";

describe("getReadableSize", () => {
  it("renders the default profile's footprint the way the hub reports it", () => {
    // 22,972,370 bytes is the real size of the installed weights.
    expect(getReadableSize(22_972_370)).toBe("23.0 MB");
  });

  it("renders the second profile's footprint", () => {
    expect(getReadableSize(34_014_426)).toBe("34.0 MB");
  });

  it("uses decimal units, so a size matches what the hub showed", () => {
    expect(getReadableSize(1_000_000)).toBe("1.0 MB");
  });

  it("reaches gigabytes for a generative model", () => {
    expect(getReadableSize(919_096_585)).toBe("919.1 MB");
    expect(getReadableSize(1_500_000_000)).toBe("1.5 GB");
  });

  it("falls back to bytes below a kilobyte", () => {
    expect(getReadableSize(650)).toBe("650 B");
  });

  it("renders zero without a unit it has not reached", () => {
    expect(getReadableSize(0)).toBe("0 B");
  });

  it("distinguishes two quantizations of one model", () => {
    expect(getReadableSize(569_789_750)).not.toBe(getReadableSize(617_687_575));
  });
});

import { describe, expect, it } from "vitest";

import { formatDownloadSize } from ".";

describe("formatDownloadSize", () => {
  it("says gigabytes to one decimal", () => {
    expect(formatDownloadSize(2_774_000_000)).toBe("2.8 GB");
  });

  it("says megabytes whole, and never zero", () => {
    expect(formatDownloadSize(274_000_000)).toBe("274 MB");
    expect(formatDownloadSize(10)).toBe("1 MB");
  });
});

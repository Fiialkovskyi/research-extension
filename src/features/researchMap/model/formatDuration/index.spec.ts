import { describe, expect, it } from "vitest";

import { formatDuration } from ".";

describe("formatDuration", () => {
  it("writes seconds under a minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45_200)).toBe("45s");
  });

  it("writes minutes under an hour", () => {
    expect(formatDuration(7 * 60_000)).toBe("7m");
    expect(formatDuration(59 * 60_000)).toBe("59m");
  });

  it("writes hours and minutes beyond", () => {
    expect(formatDuration(65 * 60_000)).toBe("1h 5m");
    expect(formatDuration(120 * 60_000)).toBe("2h");
  });
});

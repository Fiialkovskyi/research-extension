import { describe, expect, it } from "vitest";

import { getBadgeState } from ".";

describe("getBadgeState", () => {
  it("asks for setup while AI is not set up, paused or not", () => {
    expect(getBadgeState(false, false)).toBe("needsSetup");
    expect(getBadgeState(false, true)).toBe("needsSetup");
  });

  it("shows that AI is paused while Ollama does not answer", () => {
    expect(getBadgeState(true, true)).toBe("paused");
  });

  it("carries nothing while AI works", () => {
    expect(getBadgeState(true, false)).toBeUndefined();
  });
});

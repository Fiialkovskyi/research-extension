import { describe, expect, it } from "vitest";

import { getNodeEngagement } from ".";

const buildNode = (signals: Partial<Parameters<typeof getNodeEngagement>[0]["signals"]> = {}) => ({
  signals: {
    activeDwellMs: 0,
    maxScroll: 0,
    copyEvents: 0,
    focusCount: 1,
    revisitCount: 0,
    ...signals,
  },
});

const LEFT = { isFocused: false };
const FOCUSED = { isFocused: true };

describe("getNodeEngagement", () => {
  it("calls a page never focused unread, whatever else was observed", () => {
    expect(getNodeEngagement(buildNode({ focusCount: 0, copyEvents: 3 }), LEFT)).toBe("unread");
  });

  it("calls a page copied from deep read", () => {
    expect(getNodeEngagement(buildNode({ copyEvents: 1 }), LEFT)).toBe("deep_read");
  });

  it("calls a page read long enough and far enough deep read", () => {
    expect(getNodeEngagement(buildNode({ activeDwellMs: 45_000, maxScroll: 0.4 }), FOCUSED)).toBe(
      "deep_read",
    );
  });

  it("needs both the dwell and the scroll for a deep read by reading", () => {
    expect(getNodeEngagement(buildNode({ activeDwellMs: 44_999, maxScroll: 1 }), LEFT)).toBe(
      "skimmed",
    );
    expect(getNodeEngagement(buildNode({ activeDwellMs: 600_000, maxScroll: 0.39 }), LEFT)).toBe(
      "skimmed",
    );
  });

  it("calls a page come back to twice deep read", () => {
    expect(getNodeEngagement(buildNode({ revisitCount: 2, activeDwellMs: 40_000 }), LEFT)).toBe(
      "deep_read",
    );
    expect(getNodeEngagement(buildNode({ revisitCount: 1, activeDwellMs: 40_000 }), LEFT)).toBe(
      "skimmed",
    );
  });

  it("calls a page left after a glance a dead end", () => {
    expect(getNodeEngagement(buildNode({ activeDwellMs: 7_999, maxScroll: 0.14 }), LEFT)).toBe(
      "dead_end",
    );
  });

  it("does not call a page a dead end while the user is still on it", () => {
    expect(getNodeEngagement(buildNode({ activeDwellMs: 3_000 }), FOCUSED)).toBe("skimmed");
  });

  it("does not call a page a dead end once it was read or scrolled a little", () => {
    expect(getNodeEngagement(buildNode({ activeDwellMs: 8_000 }), LEFT)).toBe("skimmed");
    expect(getNodeEngagement(buildNode({ activeDwellMs: 1_000, maxScroll: 0.15 }), LEFT)).toBe(
      "skimmed",
    );
  });
});

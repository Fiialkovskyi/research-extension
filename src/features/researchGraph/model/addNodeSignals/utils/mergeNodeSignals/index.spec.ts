import { describe, expect, it } from "vitest";

import { mergeNodeSignals } from ".";
import type { StoredNode } from "@/shared/storage";

const node: StoredNode = {
  id: "node-1",
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: "https://example.org",
  domain: "example.org",
  title: "Example",
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: { activeDwellMs: 1000, maxScroll: 0.8, copyEvents: 1, focusCount: 2, revisitCount: 0 },
  tabState: "open",
  createdAt: 1,
  lastFocusedAt: 500,
};

describe("mergeNodeSignals", () => {
  it("adds dwell and every count", () => {
    expect(
      mergeNodeSignals(node, { activeDwellMs: 500, copyEvents: 2, focusCount: 1, revisitCount: 1 })
        .signals,
    ).toEqual({
      activeDwellMs: 1500,
      maxScroll: 0.8,
      copyEvents: 3,
      focusCount: 3,
      revisitCount: 1,
    });
  });

  it("keeps the deepest scroll when the reader scrolls back up", () => {
    expect(mergeNodeSignals(node, { maxScroll: 0.3 }).signals.maxScroll).toBe(0.8);
    expect(mergeNodeSignals(node, { maxScroll: 0.95 }).signals.maxScroll).toBe(0.95);
  });

  it("keeps the latest focus time, whatever order readings arrive in", () => {
    expect(mergeNodeSignals(node, { lastFocusedAt: 300 }).lastFocusedAt).toBe(500);
    expect(mergeNodeSignals(node, { lastFocusedAt: 900 }).lastFocusedAt).toBe(900);
  });

  it("records a first focus time", () => {
    const { lastFocusedAt: _ignored, ...neverFocused } = node;

    expect(mergeNodeSignals(neverFocused, { lastFocusedAt: 42 }).lastFocusedAt).toBe(42);
    expect(mergeNodeSignals(neverFocused, {})).not.toHaveProperty("lastFocusedAt");
  });

  it("leaves everything else on the node untouched", () => {
    const { signals: _signals, ...rest } = mergeNodeSignals(node, { activeDwellMs: 1 });
    const { signals: _original, ...expected } = node;

    expect(rest).toEqual(expected);
  });
});

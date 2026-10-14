import { describe, expect, it } from "vitest";

import { buildHistoryEntries } from ".";
import type { GraphSnapshot, MapActivity, MapNode } from "../../types";

const page = (id: string, createdAt: number): MapNode => ({
  id,
  title: id,
  url: `https://example.org/${id}`,
  domain: "example.org",
  kind: "page",
  tabId: 1,
  tabState: "open",
  engagement: "skimmed",
  copyEvents: 0,
  pasteEvents: 0,
  activeDwellMs: 0,
  focusCount: 0,
  revisitCount: 0,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  createdAt,
});

const snapshot = (activity: MapActivity[]): GraphSnapshot => ({
  session: { id: "s", title: "S" },
  nodes: [page("a", 1), page("b", 2)],
  edges: [],
  clusters: [],
  activity,
});

describe("buildHistoryEntries", () => {
  it("lists reading in time order, a page again where the user came back to it", () => {
    expect(
      buildHistoryEntries(
        snapshot([
          { nodeId: "a", kind: "focus", at: 50, endAt: 60 },
          { nodeId: "a", kind: "focus", at: 10, endAt: 20 },
          { nodeId: "b", kind: "focus", at: 20, endAt: 50 },
        ]),
      ),
    ).toEqual([
      { nodeId: "a", startedAt: 10, endedAt: 20 },
      { nodeId: "b", startedAt: 20, endedAt: 50 },
      { nodeId: "a", startedAt: 50, endedAt: 60 },
    ]);
  });

  it("joins back-to-back intervals on one page, and skips copies and unknown pages", () => {
    expect(
      buildHistoryEntries(
        snapshot([
          { nodeId: "a", kind: "focus", at: 10, endAt: 20 },
          { nodeId: "a", kind: "copy", at: 15, endAt: 15 },
          { nodeId: "gone", kind: "focus", at: 21, endAt: 22 },
          { nodeId: "a", kind: "focus", at: 25, endAt: 40 },
        ]),
      ),
    ).toEqual([{ nodeId: "a", startedAt: 10, endedAt: 40 }]);
  });

  it("lists pages in the order they were opened when no reading was logged", () => {
    expect(buildHistoryEntries(snapshot([]))).toEqual([
      { nodeId: "a", startedAt: 1, endedAt: null },
      { nodeId: "b", startedAt: 2, endedAt: null },
    ]);
  });
});

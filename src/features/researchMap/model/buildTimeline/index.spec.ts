import { describe, expect, it } from "vitest";

import { buildTimeline } from ".";
import type { GraphSnapshot, MapActivity, MapNode } from "../../types";

const MINUTE = 60_000;

const page = (id: string): MapNode => ({
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
  createdAt: 0,
});

const read = (nodeId: string, fromMinute: number, toMinute: number): MapActivity => ({
  nodeId,
  kind: "focus",
  at: fromMinute * MINUTE,
  endAt: toMinute * MINUTE,
});

const snapshot = (activity: MapActivity[], clusterCount = 2): GraphSnapshot => ({
  session: { id: "s", title: "S" },
  nodes: ["a", "b", "c", "d"].map(page),
  edges: [],
  clusters: Array.from({ length: clusterCount }, (_, index) => ({
    id: `k${index}`,
    label: ["Motors", "Frames"][index] ?? `Cluster ${index}`,
    memberIds: index === 0 ? ["a", "b"] : index === 1 ? ["c"] : [],
  })),
  activity,
});

describe("buildTimeline", () => {
  it("colours each interval by its page's cluster", () => {
    const { blocks } = buildTimeline(snapshot([read("c", 5, 6), read("a", 0, 5), read("d", 6, 7)]));

    expect(blocks.map(({ nodeId, slot }) => [nodeId, slot])).toEqual([
      ["a", 0],
      ["c", 1],
      ["d", null],
    ]);
  });

  it("labels back-to-back pages of one cluster once", () => {
    const { runs } = buildTimeline(snapshot([read("a", 0, 5), read("b", 5, 9), read("c", 9, 10)]));

    expect(runs).toEqual([
      { slot: 0, label: "Motors", start: 0, end: 9 * MINUTE },
      { slot: 1, label: "Frames", start: 9 * MINUTE, end: 10 * MINUTE },
    ]);
  });

  it("breaks the timeline at a pause longer than a quarter of an hour", () => {
    const { segments } = buildTimeline(
      snapshot([read("a", 0, 5), read("b", 10, 12), read("c", 120, 125)]),
    );

    expect(segments).toEqual([
      { start: 0, end: 12 * MINUTE },
      { start: 120 * MINUTE, end: 125 * MINUTE },
    ]);
  });

  it("folds clusters past the palette into Other", () => {
    const many = snapshot([], 10);

    many.clusters[9] = { id: "k9", label: "Tenth", memberIds: ["d"] };
    many.activity = [read("d", 0, 1)];

    const { blocks, legend } = buildTimeline(many);

    expect(blocks[0]?.slot).toBe("other");
    expect(legend).toEqual([{ slot: "other", label: "Other" }]);
  });

  it("marks copies and pastes, and leaves them out of the blocks", () => {
    const { blocks, marks } = buildTimeline(
      snapshot([
        read("a", 0, 5),
        { nodeId: "a", kind: "paste", at: 3 * MINUTE, endAt: 3 * MINUTE },
        { nodeId: "a", kind: "copy", at: MINUTE, endAt: MINUTE },
      ]),
    );

    expect(blocks).toHaveLength(1);
    expect(marks).toEqual([
      { nodeId: "a", kind: "copy", at: MINUTE },
      { nodeId: "a", kind: "paste", at: 3 * MINUTE },
    ]);
  });

  it("names only the clusters it shows, in the clustering's order", () => {
    const { legend } = buildTimeline(snapshot([read("c", 0, 1), read("d", 1, 2)]));

    expect(legend).toEqual([
      { slot: 1, label: "Frames" },
      { slot: null, label: "Unclustered" },
    ]);
  });
});

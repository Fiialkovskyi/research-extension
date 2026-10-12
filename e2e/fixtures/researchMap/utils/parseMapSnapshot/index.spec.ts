import { describe, expect, it } from "vitest";

import { parseMapSnapshot } from ".";

const snapshot = {
  documentId: "0.5",
  nodesChangedAt: null,
  empty: false,
  sessionTitle: "Motors",
  nodes: [
    {
      id: "a",
      label: "e-bike motors",
      kind: "serp",
      text: "e-bike motorssearch · duckduckgo.com",
      tabState: "open",
      engagement: "skimmed",
      isButton: true,
      top: 10,
      left: 20,
    },
  ],
  edges: [{ id: "a|b|refinement", kind: "refinement" }],
};

describe("parseMapSnapshot", () => {
  it("reads every field the assertions rely on", () => {
    expect(parseMapSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("rejects a node in a state the map does not draw", () => {
    const raw = JSON.stringify({ ...snapshot, nodes: [{ ...snapshot.nodes[0], tabState: "x" }] });

    expect(() => parseMapSnapshot(raw)).toThrow();
  });

  it("explains itself when the input is not a string", () => {
    expect(() => parseMapSnapshot(null)).toThrow(/JSON string, got object/);
  });
});

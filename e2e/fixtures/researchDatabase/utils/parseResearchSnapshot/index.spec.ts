import { describe, expect, it } from "vitest";

import { parseResearchSnapshot } from ".";

const snapshot = {
  sessions: [{ title: "Motors", groupId: 1791, status: "active" }],
  nodes: [
    {
      id: "node-a",
      url: "http://duckduckgo.com/?q=motors",
      kind: "serp",
      query: "motors",
      transitionType: "link",
      tabState: "open",
      hasOpener: false,
      hasParent: false,
      createdAt: 1,
    },
  ],
  edges: [{ kind: "opener", from: "node-a", to: "node-b" }],
  groups: [{ id: 1791, title: "Motors" }],
};

describe("parseResearchSnapshot", () => {
  it("reads every field the assertions rely on", () => {
    expect(parseResearchSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("passes on the reader's own error", () => {
    expect(() => parseResearchSnapshot("ERROR blocked")).toThrow(
      "The reader page could not read the database: blocked",
    );
  });

  it("rejects something that is not a snapshot", () => {
    expect(() => parseResearchSnapshot(JSON.stringify({ sessions: [] }))).toThrow();
    expect(() => parseResearchSnapshot(null)).toThrow(/got object/);
  });
});

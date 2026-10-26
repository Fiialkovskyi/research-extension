import { describe, expect, it } from "vitest";

import { parseResearchSnapshot } from ".";

const snapshot = {
  sessions: [
    { id: "session-1", title: "Motors", groupId: 1791, status: "active", savedTabCount: 2 },
  ],
  nodes: [
    {
      id: "node-a",
      sessionId: "session-1",
      url: "http://duckduckgo.com/?q=motors",
      kind: "serp",
      query: "motors",
      transitionType: "link",
      tabState: "open",
      hasOpener: false,
      hasParent: false,
      createdAt: 1,
      signals: {
        activeDwellMs: 4_000,
        maxScroll: 0.9,
        copyEvents: 1,
        focusCount: 2,
        revisitCount: 0,
      },
      contentHash: "ab12",
    },
  ],
  snapshots: [
    {
      nodeId: "node-a",
      contentHash: "ab12",
      byteLength: 3_000,
      truncated: false,
      cipher: "aes-gcm-256",
      hasPlaintext: false,
    },
  ],
  metadata: [
    {
      nodeId: "node-a",
      title: "Mid-drive motors",
      siteName: null,
      canonicalUrl: "https://example.org/motors",
      product: null,
      hasSealedDescription: true,
      hasPlaintextDescription: false,
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

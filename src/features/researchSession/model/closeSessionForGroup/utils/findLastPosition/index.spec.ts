import { describe, expect, it } from "vitest";

import { findLastPosition } from ".";
import type { StoredNode, StoredSession } from "@/shared/storage";

const SESSION: StoredSession = {
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

const node = (id: string, lastFocusedAt?: number): StoredNode => ({
  id,
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: `https://example.org/${id}`,
  domain: "example.org",
  title: `Page ${id}`,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: {
    activeDwellMs: 0,
    maxScroll: 0.4,
    copyEvents: 0,
    pasteEvents: 0,
    focusCount: 1,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open",
  createdAt: 1,
  ...(lastFocusedAt === undefined ? {} : { lastFocusedAt }),
});

describe("findLastPosition", () => {
  it("is the page in focus, with how far it was read", () => {
    const session: StoredSession = {
      ...SESSION,
      focus: {
        nodeId: "a",
        since: null,
        visitDwellMs: 0,
        isRevisit: false,
        isRevisitCounted: false,
      },
    };

    expect(findLastPosition(session, [node("a", 10), node("b", 90)])).toEqual({
      nodeId: "a",
      title: "Page a",
      readFraction: 0.4,
    });
  });

  it("falls back to the page focused last", () => {
    expect(findLastPosition(SESSION, [node("a", 10), node("b", 90), node("c")])?.nodeId).toBe("b");
  });

  it("is nothing when no page was ever focused", () => {
    expect(findLastPosition(SESSION, [node("c")])).toBeUndefined();
  });
});

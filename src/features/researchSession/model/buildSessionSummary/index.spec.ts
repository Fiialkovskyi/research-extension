import { describe, expect, it } from "vitest";

import { buildSessionSummary } from ".";

describe("buildSessionSummary", () => {
  it("keeps only what a surface renders", () => {
    expect(
      buildSessionSummary(
        {
          id: "session-1",
          title: "E-bike motors",
          groupId: 42,
          formerGroupIds: [],
          status: "active",
          createdAt: 1,
          updatedAt: 2,
        },
        3,
      ),
    ).toEqual({ id: "session-1", title: "E-bike motors", groupId: 42, pageCount: 3 });
  });

  it("says where the user left off, without which page it was", () => {
    expect(
      buildSessionSummary(
        {
          id: "session-1",
          title: "E-bike motors",
          groupId: 42,
          formerGroupIds: [],
          status: "active",
          lastPosition: { nodeId: "b", title: "Page B", readFraction: 0.4 },
          createdAt: 1,
          updatedAt: 2,
        },
        3,
      ).lastPosition,
    ).toEqual({ title: "Page B", readFraction: 0.4 });
  });
});

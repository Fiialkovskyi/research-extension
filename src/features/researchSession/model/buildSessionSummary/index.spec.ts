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
          status: "active",
          createdAt: 1,
          updatedAt: 2,
        },
        3,
      ),
    ).toEqual({ id: "session-1", title: "E-bike motors", groupId: 42, pageCount: 3 });
  });
});

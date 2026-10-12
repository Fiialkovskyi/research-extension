import { describe, expect, it } from "vitest";

import { assertNoActiveSession } from ".";

describe("assertNoActiveSession", () => {
  it("lets a start go on when no session is active", () => {
    expect(() => assertNoActiveSession(undefined)).not.toThrow();
  });

  it("names the active session when it refuses", () => {
    expect(() =>
      assertNoActiveSession({
        id: "session-1",
        title: "E-bike motors",
        groupId: 42,
        formerGroupIds: [],
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      }),
    ).toThrow('A session is already active: "E-bike motors".');
  });
});

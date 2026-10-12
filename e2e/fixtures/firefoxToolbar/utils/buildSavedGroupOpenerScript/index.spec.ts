import { describe, expect, it, vi } from "vitest";

import { buildSavedGroupOpenerScript } from ".";

const run = (SessionStore: unknown, savedId: string): unknown =>
  JSON.parse(
    (
      new Function("SessionStore", "window", buildSavedGroupOpenerScript(savedId)) as (
        s: unknown,
        w: unknown,
      ) => string
    )(SessionStore, {}),
  );

describe("buildSavedGroupOpenerScript", () => {
  it("reopens the saved group and reports the id it came back with", () => {
    const SessionStore = {
      getSavedTabGroup: vi.fn(() => ({})),
      openSavedTabGroup: vi.fn(() => ({ id: "1791-93" })),
    };

    expect(run(SessionStore, "1791-93")).toBe("1791-93");
    expect(SessionStore.openSavedTabGroup).toHaveBeenCalledWith("1791-93", {});
  });

  it("reports null when nothing was saved under the id", () => {
    const SessionStore = { getSavedTabGroup: vi.fn(() => undefined), openSavedTabGroup: vi.fn() };

    expect(run(SessionStore, "missing")).toBeNull();
    expect(SessionStore.openSavedTabGroup).not.toHaveBeenCalled();
  });
});

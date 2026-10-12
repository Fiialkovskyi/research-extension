import { describe, expect, it, vi } from "vitest";

import { type FocusApi, readFocusedTab } from ".";

const buildApi = (overrides: Partial<FocusApi> = {}): FocusApi => ({
  getLastFocusedWindow: () => Promise.resolve({ id: 3, focused: true }),
  queryIdleState: () => Promise.resolve("active"),
  queryActiveTab: (windowId) => Promise.resolve(windowId === 3 ? { id: 7 } : undefined),
  ...overrides,
});

describe("readFocusedTab", () => {
  it("returns the selected tab of the focused window while the user is active", async () => {
    expect(await readFocusedTab(buildApi())).toBe(7);
  });

  it("asks about idleness with the 60 s threshold", async () => {
    const queryIdleState = vi.fn(() => Promise.resolve("active"));

    await readFocusedTab(buildApi({ queryIdleState }));

    expect(queryIdleState).toHaveBeenCalledWith(60);
  });

  it("returns nothing while another application has focus", async () => {
    expect(
      await readFocusedTab(
        buildApi({ getLastFocusedWindow: () => Promise.resolve({ id: 3, focused: false }) }),
      ),
    ).toBeUndefined();
  });

  it("returns nothing while the user is idle or the screen is locked", async () => {
    expect(
      await readFocusedTab(buildApi({ queryIdleState: () => Promise.resolve("idle") })),
    ).toBeUndefined();
    expect(
      await readFocusedTab(buildApi({ queryIdleState: () => Promise.resolve("locked") })),
    ).toBeUndefined();
  });

  it("returns nothing for a window with no selected tab", async () => {
    expect(
      await readFocusedTab(buildApi({ queryActiveTab: () => Promise.resolve(undefined) })),
    ).toBeUndefined();
  });
});

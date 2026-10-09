import { beforeEach, describe, expect, it, vi } from "vitest";

const { click, isSelected, waitForEnabled, waitUntil } = vi.hoisted(() => ({
  click: vi.fn(),
  isSelected: vi.fn(),
  waitForEnabled: vi.fn(),
  waitUntil: vi.fn(async (condition: () => Promise<boolean>) => {
    if (!(await condition())) {
      throw new Error("waitUntil condition was not met");
    }
    return true;
  }),
}));

vi.mock("@wdio/globals", () => ({
  $: () => ({ click, isSelected, waitForEnabled }),
  browser: { waitUntil },
}));

const { selectComputeDevice } = await import("./index");

describe("selectComputeDevice", () => {
  beforeEach(() => {
    click.mockReset();
    isSelected.mockReset();
    waitForEnabled.mockReset();
  });

  it("waits for the control to be enabled before clicking it", async () => {
    isSelected.mockResolvedValue(true);

    await selectComputeDevice("webgpu");

    expect(waitForEnabled).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });

  it("resolves once the control reports itself selected", async () => {
    isSelected.mockResolvedValue(true);

    await expect(selectComputeDevice("wasm")).resolves.toBeUndefined();
  });

  it("rejects when the click does not register a selection", async () => {
    isSelected.mockResolvedValue(false);

    await expect(selectComputeDevice("wasm")).rejects.toThrow();
  });

  it("propagates a timeout while the control stays disabled", async () => {
    waitForEnabled.mockRejectedValue(new Error("stayed disabled"));
    isSelected.mockResolvedValue(true);

    await expect(selectComputeDevice("webgpu")).rejects.toThrow("stayed disabled");
    expect(click).not.toHaveBeenCalled();
  });
});

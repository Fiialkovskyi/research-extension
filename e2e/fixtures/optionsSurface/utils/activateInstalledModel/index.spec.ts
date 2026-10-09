import { beforeEach, describe, expect, it, vi } from "vitest";

import { PROBE_LIST_TEST_ID, PROBLEM_TEST_ID } from "../../constants";

const { click, isExisting, waitUntil } = vi.hoisted(() => ({
  click: vi.fn(),
  isExisting: vi.fn(),
  waitUntil: vi.fn(async (condition: () => Promise<boolean>) => {
    if (!(await condition())) {
      throw new Error("waitUntil condition was not met");
    }
    return true;
  }),
}));

vi.mock("@wdio/globals", () => ({
  $: (selector: string) => ({
    click: () => click(selector),
    isExisting: () => isExisting(selector),
  }),
  browser: { waitUntil },
}));

const { activateInstalledModel } = await import("./index");

const respond = (existingTestId: string) =>
  isExisting.mockImplementation(async (selector: string) => selector.includes(existingTestId));

describe("activateInstalledModel", () => {
  beforeEach(() => {
    click.mockReset();
    isExisting.mockReset();
  });

  it("clicks the activate control for the given reference", async () => {
    respond(PROBE_LIST_TEST_ID);

    await activateInstalledModel("Xenova/all-MiniLM-L6-v2@abc123");

    expect(click).toHaveBeenCalledWith('[data-testid="activate-Xenova/all-MiniLM-L6-v2@abc123"]');
  });

  it("resolves true once the conformance suite reports its probes", async () => {
    respond(PROBE_LIST_TEST_ID);

    await expect(activateInstalledModel("Xenova/all-MiniLM-L6-v2@abc123")).resolves.toBe(true);
  });

  it("resolves false when a problem is reported instead of probes", async () => {
    respond(PROBLEM_TEST_ID);

    await expect(activateInstalledModel("Xenova/all-MiniLM-L6-v2@abc123")).resolves.toBe(false);
  });

  it("rejects when neither probes nor a problem appear in time", async () => {
    respond("something-else");

    await expect(activateInstalledModel("Xenova/all-MiniLM-L6-v2@abc123")).rejects.toThrow();
  });
});

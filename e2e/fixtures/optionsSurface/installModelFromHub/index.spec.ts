import { beforeEach, describe, expect, it, vi } from "vitest";

import { INSTALLED_TEST_ID, INSTALL_FAILED_TEST_ID } from "../constants";

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

const { installModelFromHub } = await import("./index");

const respond = (existingTestId: string) =>
  isExisting.mockImplementation(async (selector: string) => selector.includes(existingTestId));

describe("installModelFromHub", () => {
  beforeEach(() => {
    click.mockReset();
    isExisting.mockReset();
  });

  it("clicks the install control for the given repository", async () => {
    respond(INSTALLED_TEST_ID);

    await installModelFromHub("Xenova/bge-small-en-v1.5");

    expect(click).toHaveBeenCalledWith('[data-testid="install-Xenova/bge-small-en-v1.5"]');
  });

  it("resolves true once the install is reported as finished", async () => {
    respond(INSTALLED_TEST_ID);

    await expect(installModelFromHub("Xenova/bge-small-en-v1.5")).resolves.toBe(true);
  });

  it("resolves false when the install is reported as failed", async () => {
    respond(INSTALL_FAILED_TEST_ID);

    await expect(installModelFromHub("Xenova/bge-small-en-v1.5")).resolves.toBe(false);
  });

  it("rejects when the install neither finishes nor fails in time", async () => {
    respond("something-else");

    await expect(installModelFromHub("Xenova/bge-small-en-v1.5")).rejects.toThrow();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAPABILITIES_TEST_ID } from "../constants";

const { url, waitForExist } = vi.hoisted(() => ({
  url: vi.fn(),
  waitForExist: vi.fn(),
}));

vi.mock("@wdio/globals", () => ({
  $: () => ({ waitForExist }),
  browser: { url },
}));

const { openOptionsSurface } = await import("./index");

describe("openOptionsSurface", () => {
  beforeEach(() => {
    url.mockReset();
    waitForExist.mockReset();
  });

  it("navigates to the options document at the given path", async () => {
    waitForExist.mockResolvedValue(undefined);

    await openOptionsSurface("options.html");

    expect(url).toHaveBeenCalledWith(expect.stringContaining("options.html"));
  });

  it("waits for the reported capabilities before returning", async () => {
    waitForExist.mockResolvedValue(undefined);

    await openOptionsSurface("options.html");

    expect(waitForExist).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMsg: expect.stringContaining("did not answer") }),
    );
  });

  it("propagates the timeout when the surface never answers", async () => {
    waitForExist.mockRejectedValue(
      new Error(`[data-testid="${CAPABILITIES_TEST_ID}"] never existed`),
    );

    await expect(openOptionsSurface("options.html")).rejects.toThrow();
  });
});

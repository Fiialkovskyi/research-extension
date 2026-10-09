import { beforeEach, describe, expect, it, vi } from "vitest";

import { BENCHMARK_TEST_ID, PROBLEM_TEST_ID } from "../constants";

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

const { measureThroughput } = await import("./index");

const respond = (existingTestId: string) =>
  isExisting.mockImplementation(async (selector: string) => selector.includes(existingTestId));

describe("measureThroughput", () => {
  beforeEach(() => {
    click.mockReset();
    isExisting.mockReset();
  });

  it("clicks the measure control for the given reference", async () => {
    respond(BENCHMARK_TEST_ID);

    await measureThroughput("Xenova/all-MiniLM-L6-v2@abc123");

    expect(click).toHaveBeenCalledWith('[data-testid="measure-Xenova/all-MiniLM-L6-v2@abc123"]');
  });

  it("resolves true once a throughput figure is reported", async () => {
    respond(BENCHMARK_TEST_ID);

    await expect(measureThroughput("Xenova/all-MiniLM-L6-v2@abc123")).resolves.toBe(true);
  });

  it("resolves false when a problem is reported instead of a figure", async () => {
    respond(PROBLEM_TEST_ID);

    await expect(measureThroughput("Xenova/all-MiniLM-L6-v2@abc123")).resolves.toBe(false);
  });

  it("rejects when neither a figure nor a problem appear in time", async () => {
    respond("something-else");

    await expect(measureThroughput("Xenova/all-MiniLM-L6-v2@abc123")).rejects.toThrow();
  });
});

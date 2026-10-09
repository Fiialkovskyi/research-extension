import { $, browser } from "@wdio/globals";

import { BENCHMARK_TEST_ID, INFERENCE_TIMEOUT_MS, PROBLEM_TEST_ID } from "../../constants";

/**
 * Measures embedding throughput and waits for the report.
 *
 * @param ref repository and pinned revision, as the surface lists it.
 * @returns whether a measurement was produced rather than a problem reported.
 */
export const measureThroughput = async (ref: string): Promise<boolean> => {
  await $(`[data-testid="measure-${ref}"]`).click();

  await browser.waitUntil(
    async () =>
      (await $(`[data-testid="${BENCHMARK_TEST_ID}"]`).isExisting()) ||
      (await $(`[data-testid="${PROBLEM_TEST_ID}"]`).isExisting()),
    {
      timeout: INFERENCE_TIMEOUT_MS,
      timeoutMsg: `Measuring ${ref} neither reported a figure nor a problem in time.`,
    },
  );

  return $(`[data-testid="${BENCHMARK_TEST_ID}"]`).isExisting();
};

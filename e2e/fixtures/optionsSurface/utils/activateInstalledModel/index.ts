import { $, browser } from "@wdio/globals";

import { INFERENCE_TIMEOUT_MS, PROBE_LIST_TEST_ID, PROBLEM_TEST_ID } from "../../constants";

/**
 * Runs the conformance suite against an installed model and waits for a verdict.
 *
 * Loading the model and embedding sixty probe texts happens here, so this is
 * the first point at which the runtime is exercised for real rather than
 * reported on.
 *
 * @param ref repository and pinned revision, as the surface lists it.
 * @returns whether any checks were reported, which a refusal before loading
 *   would prevent.
 */
export const activateInstalledModel = async (ref: string): Promise<boolean> => {
  await $(`[data-testid="activate-${ref}"]`).click();

  await browser.waitUntil(
    async () =>
      (await $(`[data-testid="${PROBE_LIST_TEST_ID}"]`).isExisting()) ||
      (await $(`[data-testid="${PROBLEM_TEST_ID}"]`).isExisting()),
    {
      timeout: INFERENCE_TIMEOUT_MS,
      timeoutMsg: `Activating ${ref} neither produced checks nor reported a problem in time.`,
    },
  );

  return $(`[data-testid="${PROBE_LIST_TEST_ID}"]`).isExisting();
};

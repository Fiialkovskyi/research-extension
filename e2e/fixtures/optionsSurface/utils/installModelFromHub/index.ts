import { $, browser } from "@wdio/globals";

import { INSTALL_TIMEOUT_MS, INSTALLED_TEST_ID, INSTALL_FAILED_TEST_ID } from "../../constants";

/**
 * Installs a bundled profile from the hub and waits for a verdict.
 *
 * Waits for either outcome rather than only for success, so a refusal surfaces
 * as its own reason instead of as a timeout — which is the difference between
 * learning that a digest did not match and learning nothing.
 *
 * @returns whether the install succeeded.
 */
export const installModelFromHub = async (repository: string): Promise<boolean> => {
  await $(`[data-testid="install-${repository}"]`).click();

  await browser.waitUntil(
    async () =>
      (await $(`[data-testid="${INSTALLED_TEST_ID}"]`).isExisting()) ||
      (await $(`[data-testid="${INSTALL_FAILED_TEST_ID}"]`).isExisting()),
    {
      timeout: INSTALL_TIMEOUT_MS,
      timeoutMsg: `Installing ${repository} neither finished nor failed in time.`,
    },
  );

  return $(`[data-testid="${INSTALLED_TEST_ID}"]`).isExisting();
};

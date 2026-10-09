import { $, browser } from "@wdio/globals";

import { SURFACE_TIMEOUT_MS } from "../constants";

/**
 * Chooses the compute path the next operation runs on.
 *
 * Chosen rather than left to the runtime because a throughput figure is only
 * interpretable alongside the path that produced it.
 *
 * Waits until the choice has actually taken: a click that does not register —
 * because the control was disabled by work still in flight, say — would
 * otherwise surface much later as an operation running on the wrong device,
 * reported as a device error with no hint that a click was lost.
 */
export const selectComputeDevice = async (device: "wasm" | "webgpu"): Promise<void> => {
  const control = $(`[data-testid="device-${device}"]`);

  await control.waitForEnabled({
    timeout: SURFACE_TIMEOUT_MS,
    timeoutMsg: `The ${device} control stayed disabled, so work is still in flight.`,
  });
  await control.click();

  await browser.waitUntil(async () => control.isSelected(), {
    timeout: SURFACE_TIMEOUT_MS,
    timeoutMsg: `Clicking the ${device} control did not select it.`,
  });
};

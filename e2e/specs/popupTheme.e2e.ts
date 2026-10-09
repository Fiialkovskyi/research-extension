import { expect } from "@wdio/globals";

import {
  type SystemColorScheme,
  clearSystemColorScheme,
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  placeToolbarAction,
  readPopup,
  setSystemColorScheme,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";

const openPopupUnder = async (scheme: SystemColorScheme) => {
  await setSystemColorScheme(scheme);
  await clickToolbarAction();
  await waitForPopupPanel();

  const snapshot = await readPopup();
  await closePopup();

  return snapshot;
};

describe("popup appearance", () => {
  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await clearSystemColorScheme();
    await leaveBrowserChrome();
  });

  it("follows the system colour scheme and keeps the greeting legible", async () => {
    const light = await openPopupUnder("light");
    const dark = await openPopupUnder("dark");

    // Palette-independent: the two appearances must differ, and in each the
    // greeting must not be painted onto its own background colour.
    expect(light.backgroundColor).not.toBe(dark.backgroundColor);
    expect(light.textColor).not.toBe(light.backgroundColor);
    expect(dark.textColor).not.toBe(dark.backgroundColor);

    expect(light.greeting).toBe("Hello World");
    expect(dark.greeting).toBe("Hello World");
    expect(light.greetingVisible).toBe(true);
    expect(dark.greetingVisible).toBe(true);
  });
});

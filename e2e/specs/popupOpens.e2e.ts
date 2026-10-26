import { expect } from "@wdio/globals";

import { EXTENSION_ID, POPUP_PATH } from "@/shared/config";

import { getExtensionUrl } from "../fixtures/firefoxExtension/utils";
import {
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  placeToolbarAction,
  readPopup,
  getToolbarWidgetId,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";

describe("toolbar popup", () => {
  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  afterEach(async () => {
    await closePopup();
  });

  it("opens an anchored popup showing its panel when the icon is clicked", async () => {
    await clickToolbarAction();

    const panel = await waitForPopupPanel();
    expect(panel.state).toBe("open");
    expect(panel.anchorId).toContain(getToolbarWidgetId(EXTENSION_ID));

    const popup = await readPopup();
    expect(popup.uri).toBe(getExtensionUrl(POPUP_PATH));
    expect(popup.panelVisible).toBe(true);
    expect(popup.panelWidth).toBe(416);
  });

  it("closes and reopens on a second click", async () => {
    await clickToolbarAction();
    expect((await waitForPopupPanel()).state).toBe("open");
    await closePopup();

    await clickToolbarAction();
    expect((await waitForPopupPanel()).state).toBe("open");
    expect((await readPopup()).panelVisible).toBe(true);
  });
});

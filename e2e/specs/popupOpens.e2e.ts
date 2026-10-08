import { expect } from "@wdio/globals";

import { EXTENSION_ID, POPUP_PATH } from "@/shared/config/extension";

import { getExtensionUrl } from "../fixtures/firefoxExtension";
import {
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  placeToolbarAction,
  readPopup,
  getToolbarWidgetId,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar";

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

  it("opens an anchored popup showing the greeting when the icon is clicked", async () => {
    await clickToolbarAction();

    const panel = await waitForPopupPanel();
    expect(panel.state).toBe("open");
    expect(panel.anchorId).toContain(getToolbarWidgetId(EXTENSION_ID));

    const popup = await readPopup();
    expect(popup.uri).toBe(getExtensionUrl(POPUP_PATH));
    expect(popup.greeting).toBe("Hello World");
    expect(popup.greetingVisible).toBe(true);
    expect(popup.panelWidth).toBe(320);
  });

  it("closes and reopens on a second click", async () => {
    await clickToolbarAction();
    expect((await waitForPopupPanel()).state).toBe("open");
    await closePopup();

    await clickToolbarAction();
    expect((await waitForPopupPanel()).state).toBe("open");
    expect((await readPopup()).greeting).toBe("Hello World");
  });
});

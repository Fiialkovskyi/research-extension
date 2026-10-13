import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickPopupButton,
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  placeToolbarAction,
  readPopup,
  readTabGroups,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { readSummariesPage, type SummariesSnapshot } from "../fixtures/summariesPage/utils";

// A new session, with nothing read deeply and no generation model in the suite.
describe("summaries", () => {
  const title = `Summaries ${Date.now()}`;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("opens from the popup and says what is missing before anything is summarised", async () => {
    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await submitPopupGroupTitle(title);
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );
    await closePopup();

    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await clickPopupButton("open-summaries");
    await closePopup();

    let snapshot: SummariesSnapshot | undefined;

    await browser
      .waitUntil(
        async () => {
          try {
            snapshot = await readSummariesPage();
          } catch {
            return false;
          }

          return snapshot.title !== null && snapshot.tableEmpty;
        },
        { timeout: UI_TIMEOUT_MS },
      )
      .catch(() => {
        throw new Error(`Summaries never showed the session (last: ${JSON.stringify(snapshot)}).`);
      });

    expect(snapshot?.title).toContain(title);
    // No generation model is active in the suite, so the page says what to turn on.
    expect(snapshot?.needsModel).toBe(true);
    expect(snapshot?.clusters.flatMap(({ statements }) => statements)).toEqual([]);
    // The comparison table follows, with nothing to compare yet.
    expect(snapshot?.tableEmpty).toBe(true);
  });
});

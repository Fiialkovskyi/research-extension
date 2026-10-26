import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickPopupButton,
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  loadUrlInSelectedTab,
  placeToolbarAction,
  readPopup,
  readTabGroups,
  readTabs,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { readResearchDatabase } from "../fixtures/researchDatabase/utils";
import {
  clickSummariesButton,
  readSummariesPage,
  type SummariesSnapshot,
} from "../fixtures/summariesPage/utils";

const readOrigin = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return origin;
};

// A new session of three shop pages, none read deeply, and no generation model in the suite.
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

    // Three pages that declare themselves shops: the session can tell what it lacks.
    for (const [index, page] of ["product.html", "shopB.html", "shopC.html"].entries()) {
      await loadUrlInSelectedTab(`${readOrigin()}/${page}`);
      await browser.waitUntil(
        async () =>
          (await readResearchDatabase()).metadata.filter(({ product }) => product !== null).length >
          index,
        { timeout: UI_TIMEOUT_MS, timeoutMsg: `${page} was never recorded with its markup.` },
      );
    }

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
    // Without a generation model, the questions say what to turn on.
    expect(snapshot?.questionsNeedModel).toBe(true);
    // Nothing was marked wrong yet, so no count is shown.
    expect(snapshot?.hasRejected).toBe(false);
    // Every page is a shop, so the session has read no reviews, forums or videos.
    expect(snapshot?.gaps).toContain("No reviews read yet");
    expect(snapshot?.gaps).not.toContain("No shop pages read yet");
  });

  it("opens a gap's search in a new tab of the session's group", async () => {
    await clickSummariesButton("gap-search");

    // The suite's page server speaks plain HTTP, so the https results page
    // itself does not load; the tab opened, in the group, is what is checked.
    await browser.waitUntil(
      async () =>
        (await readTabs()).some(
          (tab) => tab.url.startsWith("https://duckduckgo.com/?q=") && tab.group === title,
        ),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "No search tab opened in the session's group." },
    );
  });
});

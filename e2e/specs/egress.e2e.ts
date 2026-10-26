import { browser, expect } from "@wdio/globals";

import { OPTIONS_PATH } from "@/shared/config";
import {
  findExtensionEgress,
  probeEgress,
  readEgressLog,
  startEgressLog,
} from "../fixtures/egressLog/utils";
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
import { openOptionsSurface } from "../fixtures/optionsSurface/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { readResearchDatabase } from "../fixtures/researchDatabase/utils";
import { clickSummariesButton, readSummariesPage } from "../fixtures/summariesPage/utils";

const readOrigin = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return origin;
};

// REQ-SEC-001 to SEC-003: with no model being installed, the add-on reaches
// nowhere — not from its pages, its workers, nor the scripts it puts in pages.
describe("egress", () => {
  const title = `Egress ${Date.now()}`;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("sees a request the add-on makes", async () => {
    await startEgressLog();
    await probeEgress(`${readOrigin()}/article.html?probe`);

    expect((await readEgressLog()).map(({ url }) => url)).toContain(
      `${readOrigin()}/article.html?probe`,
    );
  });

  it("makes no request of its own through a whole session", async () => {
    await startEgressLog();

    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await submitPopupGroupTitle(title);
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );
    await closePopup();

    await loadUrlInSelectedTab(`${readOrigin()}/article.html`);
    await browser.waitUntil(
      async () =>
        (await readResearchDatabase()).nodes.some(({ url }) => url.endsWith("/article.html")),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The article was never recorded." },
    );
    await loadUrlInSelectedTab(`${readOrigin()}/a.html`);
    // Pages that declare themselves shops, so the session can tell what it lacks.
    for (const page of ["product.html", "shopB.html", "shopC.html"]) {
      await loadUrlInSelectedTab(`${readOrigin()}/${page}`);
      await browser.pause(1_000);
    }

    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await clickPopupButton("open-summaries");
    await closePopup();
    await browser.waitUntil(
      async () => {
        try {
          return (await readSummariesPage()).title !== null;
        } catch {
          return false;
        }
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The Synthesis page never showed the session." },
    );
    await clickSummariesButton("gap-search");
    await browser.waitUntil(
      async () => (await readTabs()).some((tab) => tab.url.startsWith("https://duckduckgo.com/")),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "No search tab opened." },
    );

    await leaveBrowserChrome();
    await openOptionsSurface(OPTIONS_PATH);
    await browser.pause(1_000);
    await enterBrowserChrome();

    const requests = await readEgressLog();

    console.log("[egress] requests the add-on triggered:", JSON.stringify(requests));
    expect(findExtensionEgress(requests)).toEqual([]);
  });
});

import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  loadUrlInSelectedTab,
  placeToolbarAction,
  readPopup,
  readTabGroups,
  scrollInTabShowing,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { readResearchDatabase } from "../fixtures/researchDatabase/utils";

const readOrigin = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return origin;
};

/** How long a reader may settle before the page's text is taken: 30 s of reading, and the beat. */
const READING_TIMEOUT_MS = 60_000;

// A page scrolled through half of at once and then only read: no scroll or
// copy follows, yet its text must be taken once it has been read long enough.
//
// A smoke test of the whole path, not a proof of the tick: reading the
// database from the spec opens a reader tab, and the tab change that causes
// credits the reading time on its own, so the page's text is also taken by the
// spec's own polling. That the tick alone does it is covered by the
// `backgroundApp` and `observePage` specs.
describe("reading a page without touching it", () => {
  const title = `Reading ${Date.now()}`;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await submitPopupGroupTitle(title);
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );
    await closePopup();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("takes the page's text after about 30 s of reading, with no copy", async () => {
    await loadUrlInSelectedTab(`${readOrigin()}/essay.html`);
    await browser.pause(1_500);
    await scrollInTabShowing("/essay.html", 0.5);

    // Nothing more is done to the page: only time passes.
    await browser.waitUntil(async () => (await readResearchDatabase()).snapshots.length > 0, {
      timeout: READING_TIMEOUT_MS,
      timeoutMsg: "The page was read for a minute but its text was never taken.",
      interval: 2_000,
    });

    const { nodes } = await readResearchDatabase();
    const essay = nodes.find((node) => node.url.endsWith("/essay.html"));

    expect(essay?.signals.copyEvents).toBe(0);
    expect(essay?.signals.activeDwellMs).toBeGreaterThanOrEqual(30_000);
  });
});

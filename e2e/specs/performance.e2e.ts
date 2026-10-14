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
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import {
  BACKGROUND_MEMORY_BUDGET_BYTES,
  NODE_LATENCY_BUDGET_MS,
} from "../fixtures/performanceProbe/constants";
import { getPercentile, readExtensionProcessMemory } from "../fixtures/performanceProbe/utils";
import { readResearchDatabase } from "../fixtures/researchDatabase/utils";

const readOrigin = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return origin;
};

/** Pages to cycle through; a query string makes each visit a new page. */
const PAGES = ["a.html", "b.html", "c.html", "article.html"];
const NAVIGATIONS = 20;

// Section 13's performance gates for what runs without a model.
describe("performance", () => {
  const title = `Performance ${Date.now()}`;

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

  it("records a node within 1 s of its navigation, p95 (REQ-NFR-001)", async () => {
    const latencies: number[] = [];

    for (let visit = 0; visit < NAVIGATIONS; visit += 1) {
      const url = `${readOrigin()}/${PAGES[visit % PAGES.length]}?visit=${visit}`;
      const started = Date.now();

      await loadUrlInSelectedTab(url);

      let createdAt: number | undefined;

      await browser.waitUntil(
        async () => {
          createdAt = (await readResearchDatabase()).nodes.find(
            (node) => node.url === url,
          )?.createdAt;
          return createdAt !== undefined;
        },
        { timeout: UI_TIMEOUT_MS, timeoutMsg: `${url} was never recorded.` },
      );
      latencies.push((createdAt as number) - started);
    }

    console.log("[performance] node latency, ms:", JSON.stringify(latencies));
    expect(getPercentile(latencies, 95)).toBeLessThanOrEqual(NODE_LATENCY_BUDGET_MS);
  });

  it("keeps the background within 150 MB with no model loaded (REQ-NFR-003)", async () => {
    // Settled memory: freed memory reaches the system with a delay, so the
    // least of ten samples a second apart is what the add-on actually holds.
    const samples: number[] = [];

    for (let sample = 0; sample < 10; sample += 1) {
      samples.push(await readExtensionProcessMemory());
      await browser.pause(1_000);
    }

    const memory = Math.min(...samples);

    console.log(
      "[performance] extension process, MB:",
      samples.map((value) => (value / 1024 / 1024).toFixed(0)).join(" "),
    );
    // The whole extension process, Firefox's built-in add-ons included, so an
    // upper bound on the background's share.
    expect(memory).toBeLessThanOrEqual(BACKGROUND_MEMORY_BUDGET_BYTES);
  });
});

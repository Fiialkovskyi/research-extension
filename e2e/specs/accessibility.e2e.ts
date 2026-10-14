import { browser, expect } from "@wdio/globals";

import { OPTIONS_PATH, POPUP_PATH } from "@/shared/config";
import { auditExtensionPage } from "../fixtures/accessibilityAudit/utils";
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
import { readResearchDatabase } from "../fixtures/researchDatabase/utils";

const readOrigin = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return origin;
};

/** Every page the extension shows, with a session that has a page in it. */
const PAGES = [POPUP_PATH, OPTIONS_PATH, "summaries.html", "recorded.html", "map.html"];

// Section 13's accessibility audit: every extension page against WCAG 2 A and AA.
describe("accessibility", () => {
  const title = `Accessibility ${Date.now()}`;

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
    await loadUrlInSelectedTab(`${readOrigin()}/article.html`);
    await browser.waitUntil(
      async () =>
        (await readResearchDatabase()).nodes.some(({ url }) => url.endsWith("/article.html")),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The article was never recorded." },
    );
    await leaveBrowserChrome();
  });

  it("finds a violation planted in a page", async () => {
    const violations = await auditExtensionPage(
      OPTIONS_PATH,
      `document.body.append(Object.assign(document.createElement("img"), { src: "x.png" }));`,
    );

    expect(violations.map(({ id }) => id)).toContain("image-alt");
  });

  for (const page of PAGES) {
    it(`finds nothing on ${page}`, async () => {
      const violations = await auditExtensionPage(page);

      if (violations.length > 0) {
        console.log(`[axe] ${page}`, JSON.stringify(violations, null, 2));
      }

      expect(violations).toEqual([]);
      // Audited with its content rendered, not as an empty shell.
      expect(await browser.execute(() => document.body.innerText.trim().length)).toBeGreaterThan(
        20,
      );
    });
  }
});

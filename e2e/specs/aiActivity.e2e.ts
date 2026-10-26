import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  placeToolbarAction,
  readPopup,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { putResearchRecords } from "../fixtures/researchDatabase/utils";

/**
 * An embedding model as setup leaves it: active and judged. Seeded rather than
 * set up through the page, which would need a running Ollama; the popup reads
 * only that the model is on.
 */
const ACTIVE_EMBEDDING_MODEL = {
  ref: "ollama:nomic-embed-text:latest@e2e",
  manifest: {
    reference: { hub: "ollama", repository: "nomic-embed-text:latest", revision: "e2e" },
    contract: { family: "embedding", dimensions: 768 },
  },
  active: true,
  conformance: "passed",
  diskBytes: 0,
  installedAt: 1,
};

// Once AI is set up, the popup always says what it is doing; with nothing
// queued, that is a resting status rather than nothing at all.
describe("AI activity in the popup", () => {
  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
    await putResearchRecords("models", [ACTIVE_EMBEDDING_MODEL]);
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("shows the ready strip, and no setup banner, when nothing is pending", async () => {
    await clickToolbarAction();
    await waitForPopupPanel();

    await browser.waitUntil(async () => (await readPopup()).activityState !== null, {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "The popup never showed the AI activity strip.",
    });

    const popup = await readPopup();

    expect(popup.activityState).toBe("ready");
    expect(popup.activityStrip).toContain("AI ready · everything processed");
    expect(popup.setupBanner).toBeNull();

    await closePopup();
  });
});

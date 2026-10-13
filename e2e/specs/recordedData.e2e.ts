import { browser, expect } from "@wdio/globals";

import { grantPageAccess } from "../fixtures/firefoxExtension/utils";
import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickPopupButton,
  clickToolbarAction,
  closePopup,
  copyInTabShowing,
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
import {
  clickRecordedButton,
  readRecordedPage,
  type RecordedSnapshot,
} from "../fixtures/recordedPage/utils";
import { readResearchDatabase, type ResearchSnapshot } from "../fixtures/researchDatabase/utils";

const readOrigin = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return origin;
};

/** Waits until the recorded graph satisfies `condition`, and returns it. */
const waitForGraph = async (
  condition: (snapshot: ResearchSnapshot) => boolean,
  description: string,
): Promise<ResearchSnapshot> => {
  let snapshot: ResearchSnapshot | undefined;

  await browser
    .waitUntil(
      async () => {
        snapshot = await readResearchDatabase();
        return condition(snapshot);
      },
      { timeout: UI_TIMEOUT_MS },
    )
    .catch(() => {
      throw new Error(`The graph never showed ${description} (last: ${JSON.stringify(snapshot)}).`);
    });

  return snapshot as ResearchSnapshot;
};

/** Waits until the page shows what `condition` asks for, and returns it. */
const waitForRecorded = async (
  condition: (snapshot: RecordedSnapshot) => boolean,
  description: string,
): Promise<RecordedSnapshot> => {
  let snapshot: RecordedSnapshot | undefined;

  await browser
    .waitUntil(
      async () => {
        try {
          snapshot = await readRecordedPage();
        } catch {
          return false;
        }

        return condition(snapshot);
      },
      { timeout: UI_TIMEOUT_MS },
    )
    .catch(() => {
      throw new Error(
        `"What was recorded" never showed ${description} (last: ${JSON.stringify(snapshot)}).`,
      );
    });

  return snapshot as RecordedSnapshot;
};

// A session with one deep-read article, seen, then deleted page and session.
describe("what was recorded", () => {
  const title = `Recorded ${Date.now()}`;
  let articleId = "";

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("shows each page with what was kept about it, and its text on request", async () => {
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
    await waitForGraph(
      (snapshot) => snapshot.nodes.some((node) => node.url.endsWith("/article.html")),
      "the article",
    );
    await grantPageAccess();
    await browser.pause(500);
    await scrollInTabShowing("/article.html", 1);
    await copyInTabShowing("/article.html", "#headline");

    const graph = await waitForGraph(
      (snapshot) => snapshot.snapshots.length === 1,
      "the article's snapshot",
    );

    articleId = graph.nodes.find((node) => node.url.endsWith("/article.html"))?.id ?? "";

    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await clickPopupButton("open-recorded");
    await closePopup();

    const recorded = await waitForRecorded(
      (snapshot) => snapshot.entries.length === 1,
      "the article",
    );

    expect(recorded.title).toContain(title);
    expect(recorded.entries[0]).toMatchObject({
      nodeId: articleId,
      heading: "Mid-drive motors explained",
      copies: "1",
      text: null,
    });
    expect(recorded.entries[0]?.scroll).toMatch(/^(9\d|100)%$/);
    expect(recorded.entries[0]?.snapshot).toContain("KB");
    // No generation model is active in the suite: nothing is extracted, and
    // extraction is not offered.
    expect(recorded.entries[0]?.facts).toBe("not extracted");
    expect(recorded.canExtractFacts).toBe(false);

    await clickRecordedButton("recorded-show-text", articleId);

    const withText = await waitForRecorded(
      (snapshot) => snapshot.entries[0]?.text !== null,
      "the article's text",
    );

    expect(withText.entries[0]?.text).toContain("A mid-drive motor sits at the cranks");
  });

  it("deletes the page and everything derived from it, once confirmed", async () => {
    await clickRecordedButton("recorded-delete-page", articleId);
    await clickRecordedButton("recorded-delete-page-confirm", articleId);

    await waitForRecorded((snapshot) => snapshot.entries.length === 0, "no pages");

    const graph = await readResearchDatabase();

    expect(graph.nodes.some((node) => node.id === articleId)).toBe(false);
    expect(graph.snapshots).toEqual([]);
  });

  it("deletes the session, leaving its tab group open", async () => {
    await clickRecordedButton("recorded-delete-session");
    await clickRecordedButton("recorded-delete-session-confirm");

    await waitForRecorded((snapshot) => snapshot.empty, "the empty state");

    const graph = await readResearchDatabase();

    expect(graph.sessions).toEqual([]);
    expect(graph.groups.some((group) => group.title === title)).toBe(true);
  });
});

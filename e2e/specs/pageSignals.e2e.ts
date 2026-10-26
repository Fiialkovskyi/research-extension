import { browser, expect } from "@wdio/globals";

import { grantPageAccess, revokePageAccess } from "../fixtures/firefoxExtension/utils";
import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickPopupButton,
  clickToolbarAction,
  closePopup,
  copyInTabShowing,
  enterBrowserChrome,
  leaveBrowserChrome,
  loadUrlInSelectedTab,
  openTabOutsideGroups,
  placeToolbarAction,
  readPopup,
  readTabGroups,
  scrollInTabShowing,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { readResearchDatabase, type ResearchSnapshot } from "../fixtures/researchDatabase/utils";
import { type MapSnapshot, readResearchMap } from "../fixtures/researchMap/utils";

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
      throw new Error(
        `The graph never showed ${description} (last: ${JSON.stringify(snapshot?.nodes)}).`,
      );
    });

  return snapshot as ResearchSnapshot;
};

/** Waits until the map satisfies `condition`, and returns what it showed. */
const waitForMap = async (
  condition: (snapshot: MapSnapshot) => boolean,
  description: string,
): Promise<MapSnapshot> => {
  let snapshot: MapSnapshot | undefined;

  await browser
    .waitUntil(
      async () => {
        try {
          snapshot = await readResearchMap();
        } catch {
          return false;
        }

        return condition(snapshot);
      },
      { timeout: UI_TIMEOUT_MS },
    )
    .catch(() => {
      throw new Error(`The map never showed ${description} (last: ${JSON.stringify(snapshot)}).`);
    });

  return snapshot as MapSnapshot;
};

const isArticle = (url: string): boolean => url.endsWith("/article.html");

// One session, in the order a person reads: scroll an article, spend a moment
// on it, copy from it.
describe("signals from a session page", () => {
  const title = `Signals ${Date.now()}`;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("records how far an article was scrolled", async () => {
    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await submitPopupGroupTitle(title);
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );
    await closePopup();
    // Access comes with the install; switched off here so that it can be
    // granted after the article loaded.
    await revokePageAccess();

    await loadUrlInSelectedTab(`${readOrigin()}/article.html`);
    await waitForGraph(
      (snapshot) => snapshot.nodes.some((node) => isArticle(node.url)),
      "the article",
    );
    // Granted after the article loaded: the page already open is observed
    // without a reload.
    await grantPageAccess();
    await browser.pause(500);
    await scrollInTabShowing("/article.html", 1);

    await waitForGraph(
      (snapshot) =>
        snapshot.nodes.some((node) => isArticle(node.url) && node.signals.maxScroll >= 0.9),
      "the article scrolled to its end",
    );
  });

  it("records the time the article was read", async () => {
    // Reading the database selects a tab of its own, which ends the article's
    // running stretch of reading time and records it.
    await browser.pause(1_500);

    await waitForGraph(
      (snapshot) =>
        snapshot.nodes.some((node) => isArticle(node.url) && node.signals.activeDwellMs > 0),
      "reading time on the article",
    );
  });

  it("captures the article's text once it is copied from", async () => {
    await copyInTabShowing("/article.html", "#headline");

    const graph = await waitForGraph(
      (snapshot) => snapshot.snapshots.length > 0,
      "a snapshot of the article",
    );
    const article = graph.nodes.find((node) => isArticle(node.url));

    expect(article?.signals.copyEvents).toBe(1);
    expect(graph.snapshots).toEqual([
      {
        nodeId: article?.id,
        contentHash: article?.contentHash,
        byteLength: expect.any(Number),
        truncated: false,
        // Stored only encrypted (REQ-SEC-005).
        cipher: "aes-gcm-256",
        hasPlaintext: false,
      },
    ]);
    expect(article?.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(graph.snapshots[0]?.byteLength).toBeGreaterThan(4_000);
  });

  it("shows the article as deep read on the map", async () => {
    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await clickPopupButton("open-map");
    await closePopup();

    const map = await waitForMap(
      (snapshot) => snapshot.nodes.some((node) => node.engagement === "deep_read"),
      "the article as deep read",
    );

    expect(map.nodes.find((node) => node.engagement === "deep_read")?.text).toContain("deep read");
  });

  it("records nothing for a page outside the session's group", async () => {
    await openTabOutsideGroups(`${readOrigin()}/b.html`);
    await browser.pause(1_500);

    const graph = await readResearchDatabase();

    expect(graph.nodes.some((node) => node.url.endsWith("/b.html"))).toBe(false);
  });
});

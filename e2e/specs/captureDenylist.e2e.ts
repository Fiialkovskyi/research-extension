import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickInTabShowing,
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
import { DENYLISTED_TEST_HOST, PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
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

// One session tab goes from page A, through a bank, to page C.
describe("a sensitive page in a session tab", () => {
  const title = `Denylist ${Date.now()}`;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("is never recorded, and closes the page the tab left for it", async () => {
    const bank = `http://${DENYLISTED_TEST_HOST}:${new URL(readOrigin()).port}/b.html`;

    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await submitPopupGroupTitle(title);
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );
    await closePopup();

    await loadUrlInSelectedTab(`${readOrigin()}/a.html`);
    await waitForGraph(
      (snapshot) => snapshot.nodes.some((node) => node.url.endsWith("/a.html")),
      "page A",
    );

    await loadUrlInSelectedTab(bank);
    // A link the bank's page offers is clickable only once that page has
    // loaded, so this also rules out an error page standing in for it. It
    // leads to a second page on the same denylisted host.
    await clickInTabShowing(`${DENYLISTED_TEST_HOST}:${new URL(readOrigin()).port}/b.html`, "a");
    await browser.waitUntil(
      async () => (await readTabs()).some((tab) => tab.selected && tab.url.endsWith("/a.html")),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The bank's page did not lead on to its page A." },
    );

    const graph = await waitForGraph(
      (snapshot) => snapshot.nodes.every((node) => node.tabState === "closed"),
      "page A closed",
    );

    expect(graph.nodes).toEqual([expect.objectContaining({ url: `${readOrigin()}/a.html` })]);
  });

  it("breaks the chain: the next page starts afresh", async () => {
    await loadUrlInSelectedTab(`${readOrigin()}/c.html`);

    const graph = await waitForGraph(
      (snapshot) => snapshot.nodes.some((node) => node.url.endsWith("/c.html")),
      "page C",
    );

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.some((node) => node.url.includes(DENYLISTED_TEST_HOST))).toBe(false);
    expect(graph.nodes.find((node) => node.url.endsWith("/c.html"))?.hasParent).toBe(false);
    expect(graph.edges).toEqual([]);
  });

  it("leaves nothing on the map", async () => {
    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await clickPopupButton("open-map");
    await closePopup();

    const map = await waitForMap((snapshot) => snapshot.nodes.length === 2, "two pages");

    expect(map.edges).toEqual([]);
    expect(map.nodes.map((node) => node.label).toSorted()).toEqual(["Page A", "Page C"]);
  });
});

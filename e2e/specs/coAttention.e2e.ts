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
  selectTabShowing,
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
      throw new Error(`The graph never showed ${description} (last: ${JSON.stringify(snapshot)}).`);
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

// Page A opens page C in a tab of its own, and the user compares the two.
describe("comparing two session pages", () => {
  const title = `Compare ${Date.now()}`;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("links the two pages by co-attention after three switches", async () => {
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
    await clickInTabShowing("/a.html", "#open-c");
    await waitForGraph(
      (snapshot) => snapshot.nodes.some((node) => node.url.endsWith("/c.html")),
      "page C",
    );

    for (const page of ["/a.html", "/c.html", "/a.html", "/c.html"]) {
      await selectTabShowing(page);
      await browser.pause(300);
    }

    const graph = await waitForGraph(
      (snapshot) => snapshot.edges.some((edge) => edge.kind === "coAttention"),
      "a co-attention edge",
    );
    const ids = graph.nodes.map((node) => node.id).toSorted();

    expect(graph.edges.filter((edge) => edge.kind === "coAttention")).toEqual([
      { kind: "coAttention", from: ids[0], to: ids[1] },
    ]);
  });

  it("draws the link on the map", async () => {
    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await clickPopupButton("open-map");
    await closePopup();

    const map = await waitForMap(
      (snapshot) => snapshot.edges.some((edge) => edge.kind === "coAttention"),
      "the co-attention edge",
    );

    expect(map.edges.map((edge) => edge.kind).toSorted()).toEqual(["coAttention", "opener"]);
  });
});

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

/** The page server's port, which the search hosts are served on too. */
const readPort = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return new URL(origin).port;
};

/** Waits until the recorded graph satisfies `condition`, and returns it. */
const waitForGraph = async (
  condition: (snapshot: ResearchSnapshot) => boolean,
  description: string,
): Promise<ResearchSnapshot> => {
  let snapshot: ResearchSnapshot | undefined;

  await browser.waitUntil(
    async () => {
      snapshot = await readResearchDatabase();
      return condition(snapshot);
    },
    { timeout: UI_TIMEOUT_MS, timeoutMsg: `The graph never showed ${description}.` },
  );

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

// One session, in the order a person would research: search, open a result,
// search again more narrowly.
describe("searching in a session", () => {
  const title = `Search ${Date.now()}`;
  let first = "";
  let second = "";

  before(async () => {
    const port = readPort();

    first = `http://duckduckgo.com:${port}/?q=e-bike+motors`;
    second = `http://www.bing.com:${port}/search?q=e-bike+mid-drive+motors`;
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("records a search as the root, and a narrower search as its refinement", async () => {
    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await submitPopupGroupTitle(title);
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );
    await closePopup();

    await loadUrlInSelectedTab(first);
    await waitForGraph(
      (snapshot) => snapshot.nodes.some((node) => node.url === first),
      "the first search",
    );

    // A result opened from the search, in a tab of its own.
    await clickInTabShowing("?q=e-bike+motors", "#first-result");
    await waitForGraph(
      (snapshot) => snapshot.nodes.some((node) => node.url.endsWith("/a.html")),
      "the opened result",
    );

    await selectTabShowing("?q=e-bike+motors");
    await loadUrlInSelectedTab(second);

    const graph = await waitForGraph(
      (snapshot) => snapshot.edges.some((edge) => edge.kind === "refinement"),
      "a refinement edge",
    );
    const root = graph.nodes.find((node) => node.url === first);
    const refined = graph.nodes.find((node) => node.url === second);
    const result = graph.nodes.find((node) => node.url.endsWith("/a.html"));

    expect(root).toMatchObject({ kind: "serp", query: "e-bike motors" });
    expect(refined).toMatchObject({ kind: "serp", query: "e-bike mid-drive motors" });
    expect(result).toMatchObject({ kind: "page", query: null });
    expect(graph.edges.map((edge) => [edge.kind, edge.from, edge.to]).toSorted()).toEqual(
      [
        ["opener", root?.id, result?.id],
        ["refinement", root?.id, refined?.id],
        ["sameTab", root?.id, refined?.id],
      ].toSorted(),
    );
  });

  it("draws both searches with their queries, and the refinement in a style of its own", async () => {
    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await clickPopupButton("open-map");
    await closePopup();

    const map = await waitForMap(
      (snapshot) => snapshot.nodes.length === 3 && snapshot.edges.length === 3,
      "three nodes and three edges",
    );
    const root = map.nodes.find((node) => node.label === "e-bike motors");
    const refined = map.nodes.find((node) => node.label === "e-bike mid-drive motors");

    expect(root).toMatchObject({ kind: "serp", text: expect.stringContaining("search ·") });
    expect(refined).toMatchObject({ kind: "serp", text: expect.stringContaining("search ·") });
    expect(map.nodes.filter((node) => node.kind === "page")).toHaveLength(1);
    expect(map.edges.map((edge) => edge.kind).toSorted()).toEqual([
      "opener",
      "refinement",
      "sameTab",
    ]);
    expect(refined?.top ?? 0).toBeGreaterThan(root?.top ?? Number.POSITIVE_INFINITY);
  });
});

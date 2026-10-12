import { browser, expect } from "@wdio/globals";

import { getExtensionUrl } from "../fixtures/firefoxExtension/utils";
import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickInTabShowing,
  clickPopupButton,
  clickToolbarAction,
  closePopup,
  closeTabGroup,
  enterBrowserChrome,
  leaveBrowserChrome,
  loadUrlInSelectedTab,
  placeToolbarAction,
  type PopupSnapshot,
  readPopup,
  readTabGroups,
  readTabs,
  selectTabShowing,
  submitPopupGroupTitle,
  type TabSnapshot,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { readResearchDatabase, type ResearchSnapshot } from "../fixtures/researchDatabase/utils";
import { MAP_PAGE_PATH, MAP_UPDATE_TIMEOUT_MS } from "../fixtures/researchMap/constants";
import {
  activateMapNode,
  type MapNodeSnapshot,
  type MapSnapshot,
  readResearchMap,
} from "../fixtures/researchMap/utils";

/**
 * The edges a spec about capture asserts on. The harness selects tabs while it
 * finds them, which flips focus between session pages as a user would, so
 * co-attention edges may appear; they are covered by their own spec.
 */
const withoutCoAttention = <TEdge extends { kind: string }>(edges: TEdge[]): TEdge[] =>
  edges.filter((edge) => edge.kind !== "coAttention");

/** Opens the popup, reads it, and closes it again. */
const readPopupOnce = async (): Promise<PopupSnapshot> => {
  await clickToolbarAction();
  await waitForPopupPanel();

  const snapshot = await readPopup();

  await closePopup();

  return snapshot;
};

/** Chooses "Open map" in the popup. */
const openMapFromPopup = async (): Promise<void> => {
  await clickToolbarAction();
  await waitForPopupPanel();
  await readPopup();
  await clickPopupButton("open-map");
  await closePopup();
};

const readOrigin = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return origin;
};

const isMapUrl = (url: string | undefined): boolean =>
  url?.startsWith(getExtensionUrl(MAP_PAGE_PATH)) === true;

const isMapTab = (tab: TabSnapshot): boolean => isMapUrl(tab.url);

const readSelectedUrl = async (): Promise<string | undefined> =>
  (await readTabs()).find((tab) => tab.selected)?.url;

/** Waits until the map shows what `condition` asks for, and returns what it showed. */
const waitForMap = async (
  condition: (snapshot: MapSnapshot) => boolean,
  description: string,
): Promise<MapSnapshot> => {
  let snapshot: MapSnapshot | undefined;
  let failure = "";

  await browser
    .waitUntil(
      async () => {
        try {
          snapshot = await readResearchMap();
        } catch (error) {
          failure = String(error);
          return false;
        }

        return condition(snapshot);
      },
      { timeout: UI_TIMEOUT_MS },
    )
    .catch(() => {
      throw new Error(
        `The map never showed ${description} (last: ${JSON.stringify(snapshot)}${failure === "" ? "" : `; last read failed: ${failure}`}).`,
      );
    });

  return snapshot as MapSnapshot;
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

const findByLabel = (snapshot: MapSnapshot, label: string): MapNodeSnapshot => {
  const node = snapshot.nodes.find((candidate) => candidate.label === label);

  if (node === undefined) {
    throw new Error(`The map shows no node labelled "${label}".`);
  }

  return node;
};

// The cases run in order against one session, as a user's research would:
// each builds on what the one before it left open.
describe("the research map", () => {
  const title = `Map ${Date.now()}`;
  /** The map page's document, so a later read can tell it was not reloaded. */
  let documentId: string | undefined;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("is not offered while no session is active", async () => {
    expect((await readPopupOnce()).hasOpenMap).toBe(false);
  });

  it("opens from the popup outside the session's group, and records nothing for itself", async () => {
    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await submitPopupGroupTitle(title);
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
    );
    await closePopup();

    // The session's tab is selected; it reads page A before the map opens.
    await loadUrlInSelectedTab(`${readOrigin()}/a.html`);
    await waitForGraph(
      (snapshot) => snapshot.nodes.some((node) => node.url.endsWith("/a.html")),
      "page A",
    );

    await openMapFromPopup();

    const mapTabs = await browser.waitUntil(
      async () => {
        const found = (await readTabs()).filter(isMapTab);
        return found.length > 0 ? found : false;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The popup opened no map tab." },
    );

    expect(mapTabs).toEqual([expect.objectContaining({ group: null })]);

    const map = await waitForMap(
      (snapshot) => snapshot.nodes.some((node) => node.label === "Page A"),
      "page A",
    );

    documentId = map.documentId;
    expect(map.sessionTitle).toBe(title);

    const graph = await readResearchDatabase();

    expect(graph.nodes.every((node) => node.url.startsWith("http"))).toBe(true);
    expect(graph.nodes).toHaveLength(1);
  });

  it("draws the pages, their states and both kinds of edge, without reloading", async () => {
    // A opens C in a new tab; then the session's first tab moves on from A to B.
    await clickInTabShowing("/a.html", "#open-c");
    await waitForGraph(
      (snapshot) => snapshot.nodes.some((node) => node.url.endsWith("/c.html")),
      "page C",
    );
    await selectTabShowing("/a.html");
    await loadUrlInSelectedTab(`${readOrigin()}/b.html`);

    const map = await waitForMap(
      (snapshot) =>
        snapshot.nodes.length === 3 &&
        withoutCoAttention(snapshot.edges).length === 2 &&
        snapshot.nodes.some((node) => node.label === "Page B") &&
        snapshot.nodes.some((node) => node.label === "Page A" && node.tabState === "closed"),
      "pages A, B and C",
    );

    const a = findByLabel(map, "Page A");
    const b = findByLabel(map, "Page B");
    const c = findByLabel(map, "Page C");

    expect(a).toMatchObject({ tabState: "closed", isButton: false });
    expect(b).toMatchObject({ tabState: "open", isButton: true });
    expect(c).toMatchObject({ tabState: "open", isButton: true });
    expect(
      withoutCoAttention(map.edges)
        .map((edge) => [edge.id, edge.kind])
        .toSorted(),
    ).toEqual(
      [
        [`${a.id}|${b.id}|sameTab`, "sameTab"],
        [`${a.id}|${c.id}|opener`, "opener"],
      ].toSorted(),
    );
    expect(b.top).toBeGreaterThan(a.top);
    expect(c.top).toBeGreaterThan(a.top);
    expect(map.documentId).toBe(documentId);
  });

  it("returns to an open page's tab when its node is clicked", async () => {
    await activateMapNode("Page C");

    await browser.waitUntil(async () => (await readSelectedUrl())?.endsWith("/c.html") === true, {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "Clicking page C did not select its tab.",
    });
  });

  it("returns to an open page's tab when its node is activated from the keyboard", async () => {
    await activateMapNode("Page B", "keyboard");

    await browser.waitUntil(async () => (await readSelectedUrl())?.endsWith("/b.html") === true, {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "Enter on page B did not select its tab.",
    });
  });

  it("changes no tab when a closed page's node is clicked", async () => {
    // Reaching the map selects its tab; a closed node must leave it selected.
    await activateMapNode("Page A");
    await browser.pause(500);

    expect(isMapUrl(await readSelectedUrl())).toBe(true);
  });

  it("shows a page read while it is open within a second", async () => {
    const before = await readResearchMap();
    const again = `${readOrigin()}/a.html?again`;

    await selectTabShowing("/b.html");
    await loadUrlInSelectedTab(again);

    const graph = await waitForGraph(
      (snapshot) => snapshot.nodes.some((node) => node.url === again),
      "the page read again",
    );
    const map = await waitForMap(
      (snapshot) => snapshot.nodes.length === before.nodes.length + 1,
      "the page read again",
    );
    const recordedAt = graph.nodes.find((node) => node.url === again)?.createdAt ?? Number.NaN;

    // Both clocks are this machine's: the page stamps when its node count
    // changed, the background when it recorded the node.
    expect((map.nodesChangedAt ?? Number.POSITIVE_INFINITY) - recordedAt).toBeLessThanOrEqual(
      MAP_UPDATE_TIMEOUT_MS,
    );
    expect(map.documentId).toBe(documentId);
  });

  it("selects the open map rather than opening a second one", async () => {
    await selectTabShowing("/a.html?again");
    await openMapFromPopup();

    await browser.waitUntil(async () => isMapUrl(await readSelectedUrl()), {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "Opening the map again did not select the map's tab.",
    });
    expect((await readTabs()).filter(isMapTab)).toHaveLength(1);
  });

  it("says no session is active once the session's group is closed", async () => {
    await closeTabGroup(title);

    const map = await waitForMap((snapshot) => snapshot.empty, "the empty state");

    expect(map.nodes).toHaveLength(0);
    expect(map.documentId).toBe(documentId);
    expect((await readPopupOnce()).hasOpenMap).toBe(false);
  });

  it("says no session is active when opened without one", async () => {
    await selectTabShowing(MAP_PAGE_PATH);
    await loadUrlInSelectedTab(getExtensionUrl(MAP_PAGE_PATH));

    const map = await waitForMap(
      (snapshot) => snapshot.documentId !== documentId && snapshot.empty,
      "the empty state in a freshly loaded map",
    );

    expect(map.nodes).toHaveLength(0);
  });
});

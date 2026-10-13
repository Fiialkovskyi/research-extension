import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickPopupButton,
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  loadUrlInSelectedTab,
  placeToolbarAction,
  type PopupSnapshot,
  readPopup,
  readTabGroups,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { readResearchDatabase, type ResearchSnapshot } from "../fixtures/researchDatabase/utils";

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

/** Opens the popup and reads it until `condition` holds; leaves it open. */
const waitForPopup = async (
  condition: (snapshot: PopupSnapshot) => boolean,
  description: string,
): Promise<PopupSnapshot> => {
  let snapshot: PopupSnapshot | undefined;

  await clickToolbarAction();
  await waitForPopupPanel();
  await browser
    .waitUntil(
      async () => {
        snapshot = await readPopup();
        return condition(snapshot);
      },
      { timeout: UI_TIMEOUT_MS },
    )
    .catch(() => {
      throw new Error(`The popup never showed ${description} (last: ${JSON.stringify(snapshot)}).`);
    });

  return snapshot as PopupSnapshot;
};

/** Starts a session titled `title` from the popup. */
const startSession = async (title: string) => {
  await clickToolbarAction();
  await waitForPopupPanel();
  await readPopup();
  await submitPopupGroupTitle(title);
  await browser.waitUntil(
    async () => (await readTabGroups()).some((group) => group.label === title),
    { timeout: UI_TIMEOUT_MS, timeoutMsg: `No tab group titled "${title}" appeared.` },
  );
  await closePopup();
};

// Research saved last time, and a new session that turns out to continue it.
describe("continuing saved research", () => {
  const savedTitle = `Motors ${Date.now()}`;
  const newTitle = `Mid-drive ${Date.now()}`;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("offers to continue a saved session when a new one searches the same subject", async () => {
    await startSession(savedTitle);
    await loadUrlInSelectedTab(`http://duckduckgo.com:${readPort()}/?q=e-bike+motors`);
    await waitForGraph((snapshot) => snapshot.nodes.length === 1, "the first search");

    await clickToolbarAction();
    await waitForPopupPanel();
    await readPopup();
    await clickPopupButton("save-session");
    await closePopup().catch(() => undefined);
    await waitForGraph(
      (snapshot) => snapshot.sessions.some((session) => session.status === "saved"),
      "the saved session",
    );

    await startSession(newTitle);
    await loadUrlInSelectedTab(`http://duckduckgo.com:${readPort()}/?q=e-bike+mid-drive+motors`);

    const popup = await waitForPopup(
      (snapshot) => snapshot.reattachOffer !== null,
      "the offer to continue",
    );

    expect(popup.reattachOffer).toContain(savedTitle);
  });

  it("continues it: one session holds both searches, the new one refining the first", async () => {
    await clickPopupButton("reattach-continue");
    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === savedTitle),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The group was never renamed to the saved session." },
    );
    await closePopup().catch(() => undefined);

    const graph = await waitForGraph(
      (snapshot) => snapshot.edges.some((edge) => edge.kind === "refinement"),
      "a refinement of the first search",
    );

    expect(graph.sessions.filter((session) => session.status === "active")).toEqual([
      expect.objectContaining({ title: savedTitle }),
    ]);
    expect(graph.sessions.some((session) => session.title === newTitle)).toBe(false);
    expect(graph.nodes.map((node) => node.query).toSorted()).toEqual([
      "e-bike mid-drive motors",
      "e-bike motors",
    ]);
  });
});

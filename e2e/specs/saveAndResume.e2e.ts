import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickInTabShowing,
  clickPopupButton,
  selectPopupSession,
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
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
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

const isSessionUrl = (url: string) => url.endsWith("/a.html") || url.endsWith("/c.html");

// Page A opens page C; the user is on A when they close the session's group.
describe("saving and resuming research", () => {
  const title = `Saved ${Date.now()}`;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("keeps the session saved: once its group is closed the library lists it", async () => {
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
    await waitForGraph((snapshot) => snapshot.nodes.length === 2, "pages A and C");
    await selectTabShowing("/a.html");
    await waitForGraph(
      (snapshot) =>
        snapshot.sessions.some(
          (session) => session.status === "active" && session.savedTabCount === 2,
        ),
      "both tabs on record",
    );

    await closeTabGroup(title);

    const graph = await waitForGraph(
      (snapshot) => snapshot.sessions.some((session) => session.status === "closed"),
      "the closed session",
    );

    expect(graph.nodes.every((node) => node.tabState === "closed")).toBe(true);
    expect((await readTabs()).some((tab) => isSessionUrl(tab.url))).toBe(false);

    const popup = await waitForPopup(
      (snapshot) => snapshot.savedSessions.some((entry) => entry.includes(title)),
      "the saved session in the library",
    );

    expect(popup.savedSessions.find((entry) => entry.includes(title))).toContain(
      "You left off at Page A",
    );
  });

  it("resumes it: the group comes back with its tabs and pages, where the user left off", async () => {
    await selectPopupSession(title);
    await clickPopupButton("resume-session");
    await closePopup().catch(() => undefined);

    await browser.waitUntil(
      async () => (await readTabGroups()).some((group) => group.label === title),
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "The session's group never came back." },
    );

    // Read first: the database reader finds its tab by switching through tabs,
    // which selects page C — moving on from where the user left off.
    const popup = await waitForPopup(
      (snapshot) => snapshot.leftOff !== null,
      "where the user left off",
    );

    expect(popup.leftOff).toContain("You left off at Page A");
    await closePopup();

    const tabs = (await readTabs()).filter((tab) => tab.group === title);

    expect(tabs.map((tab) => tab.url.replace(readOrigin(), ""))).toEqual(["/a.html", "/c.html"]);
    expect(tabs.find((tab) => tab.url.endsWith("/a.html"))?.selected).toBe(true);

    const graph = await waitForGraph(
      (snapshot) => snapshot.sessions.some((session) => session.status === "active"),
      "the resumed session",
    );

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.every((node) => node.tabState === "open")).toBe(true);
  });
});

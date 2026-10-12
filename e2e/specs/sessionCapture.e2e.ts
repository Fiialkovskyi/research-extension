import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickInTabShowing,
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  loadUrlInSelectedTab,
  moveTabToGroup,
  openTabOutsideGroups,
  placeToolbarAction,
  type PopupSnapshot,
  readPopup,
  readTabGroups,
  submitPopupGroupTitle,
  ungroupTab,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { readResearchDatabase, type ResearchSnapshot } from "../fixtures/researchDatabase/utils";

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

/**
 * Waits until a freshly opened popup reports `expected`. The popup asks for
 * the count once, as it opens, so each attempt opens it anew.
 */
const waitForPageCount = async (expected: string): Promise<void> => {
  let last: string | null = null;

  await browser.waitUntil(
    async () => {
      last = (await readPopupOnce()).pageCount;
      return last === expected;
    },
    {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: `The popup never said "${expected}" (last: ${String(last)}).`,
    },
  );
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

const readOrigin = (): string => {
  const origin = process.env[PAGE_ORIGIN_VARIABLE];

  if (origin === undefined) {
    throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
  }

  return origin;
};

// The cases run in order against one session, as a user's research would:
// each builds on the pages the one before it recorded.
describe("capturing a session's pages", () => {
  const title = `Capture ${Date.now()}`;

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
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("records each page read in the session's tab, linked to the one before", async () => {
    const origin = readOrigin();

    // The session's tab is the selected one, showing the new-tab page, which
    // is never recorded.
    await waitForPageCount("0 pages recorded");

    await loadUrlInSelectedTab(`${origin}/a.html`);
    await waitForPageCount("1 page recorded");

    await loadUrlInSelectedTab(`${origin}/b.html`);
    await waitForPageCount("2 pages recorded");

    const graph = await readResearchDatabase();

    expect(graph.nodes.find((node) => node.url.endsWith("/a.html"))).toMatchObject({
      tabState: "closed",
    });
    expect(graph.nodes.find((node) => node.url.endsWith("/b.html"))).toMatchObject({
      tabState: "open",
      hasParent: true,
    });
    expect(withoutCoAttention(graph.edges).map((edge) => edge.kind)).toEqual(["sameTab"]);
    expect((await readPopupOnce()).activeSession).toContain(title);
  });

  it("links a page opened in a new tab to the page it was opened from", async () => {
    await loadUrlInSelectedTab(`${readOrigin()}/a.html`);
    await waitForPageCount("3 pages recorded");

    await clickInTabShowing("/a.html", "#open-c");

    const graph = await waitForGraph(
      (snapshot) => snapshot.nodes.some((node) => node.url.endsWith("/c.html")),
      "page C",
    );

    // Recorded by its own navigation ("link"), not on joining the group: the
    // new tab was already in the group when its page committed.
    expect(graph.nodes.find((node) => node.url.endsWith("/c.html"))).toMatchObject({
      transitionType: "link",
      hasOpener: true,
      hasParent: false,
    });
    expect(graph.edges.filter((edge) => edge.kind === "opener")).toHaveLength(1);
  });

  it("records a tab moved into the group, and closes it when it leaves", async () => {
    const outside = `${readOrigin()}/b.html?outside`;

    await openTabOutsideGroups(outside);
    // Moved only once it shows its page, as a tab the user drags would.
    await browser.waitUntil(
      async () => {
        try {
          await moveTabToGroup(outside, title);
          return true;
        } catch {
          return false;
        }
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: `The tab showing ${outside} never loaded.` },
    );

    await waitForGraph(
      (snapshot) =>
        snapshot.nodes.some(
          (node) =>
            node.url === outside && node.transitionType === "joined" && node.tabState === "open",
        ),
      "the moved tab recorded as joined",
    );

    await ungroupTab(outside);

    await waitForGraph(
      (snapshot) =>
        snapshot.nodes.some((node) => node.url === outside && node.tabState === "closed"),
      "the moved tab closed after it left the group",
    );
  });
});

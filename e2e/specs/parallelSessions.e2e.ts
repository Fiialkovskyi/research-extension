import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  loadUrlInSelectedTab,
  placeToolbarAction,
  readPopup,
  readTabGroups,
  submitPopupGroupTitle,
  waitForPopupPanel,
} from "../fixtures/firefoxToolbar/utils";
import { PAGE_ORIGIN_VARIABLE } from "../fixtures/pageServer/constants";
import { readResearchDatabase } from "../fixtures/researchDatabase/utils";

/** Starts a session from the popup and waits for its tab group. */
const startSession = async (title: string): Promise<void> => {
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

describe("recording two sessions at once", () => {
  const first = `Parallel A ${Date.now()}`;
  const second = `Parallel B ${Date.now()}`;

  before(async () => {
    await enterBrowserChrome();
    await placeToolbarAction();
  });

  after(async () => {
    await leaveBrowserChrome();
  });

  it("keeps each session's pages in its own graph", async () => {
    const origin = process.env[PAGE_ORIGIN_VARIABLE];

    if (origin === undefined) {
      throw new Error(`${PAGE_ORIGIN_VARIABLE} is not set; the page server did not start.`);
    }

    // Each start selects the new group's tab, so the page loads into that session.
    await startSession(first);
    await loadUrlInSelectedTab(`${origin}/a.html`);
    await startSession(second);
    await loadUrlInSelectedTab(`${origin}/b.html`);

    const graph = await browser.waitUntil(
      async () => {
        const snapshot = await readResearchDatabase();

        return snapshot.nodes.some((node) => node.url.endsWith("/a.html")) &&
          snapshot.nodes.some((node) => node.url.endsWith("/b.html"))
          ? snapshot
          : false;
      },
      { timeout: UI_TIMEOUT_MS, timeoutMsg: "Both pages were never recorded." },
    );
    const idOf = (title: string) => graph.sessions.find((session) => session.title === title)?.id;

    expect(graph.sessions.filter((session) => session.status === "active")).toHaveLength(2);
    expect(graph.nodes.find((node) => node.url.endsWith("/a.html"))?.sessionId).toBe(idOf(first));
    expect(graph.nodes.find((node) => node.url.endsWith("/b.html"))?.sessionId).toBe(idOf(second));
    // No edge crosses from one session's graph into the other's.
    const sessionOf = new Map(graph.nodes.map((node) => [node.id, node.sessionId]));

    for (const edge of graph.edges) {
      expect(sessionOf.get(edge.from)).toBe(sessionOf.get(edge.to));
    }
  });
});

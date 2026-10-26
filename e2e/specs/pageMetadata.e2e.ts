import { browser, expect } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../fixtures/firefoxToolbar/constants";
import {
  clickToolbarAction,
  closePopup,
  enterBrowserChrome,
  leaveBrowserChrome,
  loadUrlInSelectedTab,
  openTabOutsideGroups,
  placeToolbarAction,
  readPopup,
  readTabGroups,
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

/** Waits until the stored graph satisfies `condition`, and returns it. */
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
        `The graph never showed ${description} (last: ${JSON.stringify(snapshot?.metadata)}).`,
      );
    });

  return snapshot as ResearchSnapshot;
};

// What a page says about itself in its head is stored at once, for a page in a
// session, with the description sealed; a page outside the session stores none.
describe("a page's metadata", () => {
  const title = `Metadata ${Date.now()}`;

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

  it("is stored as the page loads, without a deep read, with its description sealed", async () => {
    await loadUrlInSelectedTab(`${readOrigin()}/briefing.html`);

    const graph = await waitForGraph(
      (snapshot) => snapshot.metadata.length > 0,
      "metadata for the briefing page",
    );
    const node = graph.nodes.find((candidate) => candidate.url.endsWith("/briefing.html"));

    expect(graph.metadata).toEqual([
      {
        nodeId: node?.id,
        title: "Hub motors briefing",
        siteName: "Bike Lab",
        canonicalUrl: "https://example.org/briefing",
        product: null,
        hasSealedDescription: true,
        hasPlaintextDescription: false,
      },
    ]);
    // Read, not deeply read: no text was taken.
    expect(graph.snapshots).toEqual([]);
  });

  it("keeps the product a shop page describes in its markup", async () => {
    await loadUrlInSelectedTab(`${readOrigin()}/product.html`);

    const graph = await waitForGraph(
      (snapshot) => snapshot.metadata.some(({ product }) => product !== null),
      "the product of the shop page",
    );

    expect(graph.metadata.find(({ product }) => product !== null)?.product).toEqual({
      name: "Pixel 10a 8/256GB",
      price: 24399,
      currency: "UAH",
    });
  });

  it("stores none for a page outside the session's group", async () => {
    await openTabOutsideGroups(`${readOrigin()}/briefing.html?outside`);
    await browser.pause(1_500);

    const graph = await readResearchDatabase();

    expect(graph.metadata).toHaveLength(2);
    expect(graph.nodes.some((node) => node.url.includes("?outside"))).toBe(false);
  });
});

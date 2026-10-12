import { browser } from "@wdio/globals";

import { getExtensionUrl } from "../../../firefoxExtension/utils";
import {
  enterBrowserChrome,
  leaveBrowserChrome,
  openTabOutsideGroups,
} from "../../../firefoxToolbar/utils";
import {
  READER_PAGE_PATH,
  REMEMBER_SELECTED_TAB_SCRIPT,
  RESTORE_SELECTED_TAB_SCRIPT,
} from "../../constants";
import { parseResearchSnapshot, type ResearchSnapshot } from "../parseResearchSnapshot";

/** How a tab group looks through the reader page's `browser.tabGroups`. */
interface ExtensionTabGroup {
  id: number;
  title?: string;
}

/**
 * Reads the extension's sessions, graph and tab groups as the extension itself
 * sees them. Must be called in the chrome context, and returns to it.
 *
 * Opens an extension page in a tab of its own, outside any group, and reads
 * from there: the database belongs to the extension's origin, and the group
 * ids an assertion compares with the database are the ones `tabGroups` hands
 * the extension. The page is closed again before returning.
 */
export const readResearchDatabase = async (): Promise<ResearchSnapshot> => {
  const readerUrl = getExtensionUrl(READER_PAGE_PATH);

  // Switching to the reader's tab selects it, and so does switching back to
  // any tab afterwards. The tab the user had selected is remembered here and
  // selected again at the end, so a spec's next step acts where it expects.
  await browser.executeScript(REMEMBER_SELECTED_TAB_SCRIPT, []);
  await openTabOutsideGroups(readerUrl);
  await leaveBrowserChrome();

  try {
    await browser.waitUntil(async () => {
      for (const handle of await browser.getWindowHandles()) {
        await browser.switchToWindow(handle);

        // The URL is the reader's as soon as its load starts; a script run
        // before the load finishes is lost with the document it ran in.
        if (
          (await browser.getUrl()) === readerUrl &&
          (await browser.execute(() => document.readyState)) === "complete"
        ) {
          return true;
        }
      }

      return false;
    });

    const raw = await browser.execute(
      () =>
        new Promise<string>((resolve) => {
          const extension = (
            globalThis as unknown as {
              browser: { tabGroups: { query: (query: object) => Promise<ExtensionTabGroup[]> } };
            }
          ).browser;
          const request = indexedDB.open("research-graph");

          // A read that cannot finish says so rather than hanging the spec.
          setTimeout(() => resolve("ERROR the database did not answer within 5 s"), 5000);

          request.addEventListener("error", () => resolve(`ERROR ${String(request.error)}`));
          request.addEventListener("success", () => {
            const transaction = request.result.transaction(["sessions", "nodes", "edges"]);
            const sessions = transaction.objectStore("sessions").getAll();
            const nodes = transaction.objectStore("nodes").getAll();
            const edges = transaction.objectStore("edges").getAll();

            transaction.addEventListener("complete", () => {
              void extension.tabGroups.query({}).then(
                (groups) => {
                  resolve(
                    JSON.stringify({
                      sessions: sessions.result.map(({ title, groupId, status }) => ({
                        title,
                        groupId,
                        status,
                      })),
                      nodes: nodes.result.map((node) => ({
                        url: node.url,
                        transitionType: node.transitionType,
                        tabState: node.tabState,
                        hasOpener: node.openerNodeId !== null,
                        hasParent: node.parentNodeId !== null,
                      })),
                      edges: edges.result.map(({ kind }) => ({ kind })),
                      groups: groups.map(({ id, title }) => ({ id, title: title ?? "" })),
                    }),
                  );
                },
                (error: unknown) => resolve(`ERROR ${String(error)}`),
              );
            });
          });
        }),
    );

    await browser.closeWindow();

    return parseResearchSnapshot(raw);
  } finally {
    const [remaining] = await browser.getWindowHandles();

    if (remaining !== undefined) {
      await browser.switchToWindow(remaining);
    }

    await enterBrowserChrome();
    await browser.executeScript(RESTORE_SELECTED_TAB_SCRIPT, []);
  }
};

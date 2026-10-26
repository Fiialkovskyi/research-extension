import { browser } from "@wdio/globals";

import { parseResearchSnapshot, type ResearchSnapshot } from "../parseResearchSnapshot";
import { runInReaderPage } from "../runInReaderPage";

/** How a tab group looks through the reader page's `browser.tabGroups`. */
interface ExtensionTabGroup {
  id: number;
  title?: string;
}

/**
 * Reads the extension's sessions, graph and tab groups as the extension itself
 * sees them. Must be called in the chrome context, and returns to it.
 */
export const readResearchDatabase = (): Promise<ResearchSnapshot> =>
  runInReaderPage(async () => {
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
            const transaction = request.result.transaction([
              "sessions",
              "nodes",
              "edges",
              "snapshots",
            ]);
            const sessions = transaction.objectStore("sessions").getAll();
            const nodes = transaction.objectStore("nodes").getAll();
            const edges = transaction.objectStore("edges").getAll();
            const snapshots = transaction.objectStore("snapshots").getAll();

            transaction.addEventListener("complete", () => {
              void extension.tabGroups.query({}).then(
                (groups) => {
                  resolve(
                    JSON.stringify({
                      sessions: sessions.result.map(
                        ({ id, title, groupId, status, savedTabs }) => ({
                          id,
                          title,
                          groupId,
                          status,
                          savedTabCount: savedTabs?.length ?? 0,
                        }),
                      ),
                      nodes: nodes.result.map((node) => ({
                        id: node.id,
                        sessionId: node.sessionId,
                        url: node.url,
                        kind: node.kind,
                        query: node.query ?? null,
                        transitionType: node.transitionType,
                        tabState: node.tabState,
                        hasOpener: node.openerNodeId !== null,
                        hasParent: node.parentNodeId !== null,
                        createdAt: node.createdAt,
                        signals: node.signals,
                        contentHash: node.contentHash ?? null,
                      })),
                      snapshots: snapshots.result.map((snapshot) => ({
                        nodeId: snapshot.nodeId,
                        contentHash: snapshot.contentHash,
                        byteLength: snapshot.byteLength,
                        truncated: snapshot.truncated,
                        cipher: snapshot.cipher ?? null,
                        hasPlaintext: "compressedText" in snapshot,
                      })),
                      edges: edges.result.map(({ kind, from, to }) => ({ kind, from, to })),
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

    return parseResearchSnapshot(raw);
  });

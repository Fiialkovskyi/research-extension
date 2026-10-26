import { browser } from "@wdio/globals";

import { runInReaderPage } from "../runInReaderPage";

/**
 * Writes records into one of the extension's stores, as a spec's setup, from
 * inside the extension's origin. Must be called in the chrome context, and
 * returns to it.
 *
 * For state a spec cannot reach through the UI without an outside service —
 * an active model, without a running Ollama — and nothing else: a spec that can
 * get somewhere by clicking should click.
 *
 * @throws When the database refuses the write.
 */
export const putResearchRecords = (storeName: string, records: readonly unknown[]): Promise<void> =>
  runInReaderPage(async () => {
    const outcome = await browser.execute(
      (name: string, values: unknown[]) =>
        new Promise<string>((resolve) => {
          const request = indexedDB.open("research-graph");

          // A write that cannot finish says so rather than hanging the spec.
          setTimeout(() => resolve("ERROR the database did not answer within 5 s"), 5000);

          request.addEventListener("error", () => resolve(`ERROR ${String(request.error)}`));
          request.addEventListener("success", () => {
            const transaction = request.result.transaction(name, "readwrite");

            for (const value of values) {
              transaction.objectStore(name).put(value);
            }

            transaction.addEventListener("complete", () => resolve("OK"));
            transaction.addEventListener("error", () =>
              resolve(`ERROR ${String(transaction.error)}`),
            );
          });
        }),
      storeName,
      [...records],
    );

    if (outcome !== "OK") {
      throw new Error(`Could not write to "${storeName}": ${outcome.replace(/^ERROR /u, "")}`);
    }
  });

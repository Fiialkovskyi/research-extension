import { useEffect, useRef } from "react";

import type { DataTopic } from "../../types";

/** How a page hears that data changed: told the topics, until it stops. */
export type WatchData = (onChange: (topics: readonly DataTopic[]) => void) => () => void;

/**
 * Runs `reload` when data of a kind the page shows changed.
 *
 * A change arriving while a reload runs is not lost and does not start a second
 * one beside it: the page reloads once more when the first is done, so the last
 * thing it shows is never older than the last change it heard.
 *
 * @param watch How to hear about changes; `undefined` where a page has no port.
 * @param topics The kinds of data the page shows. Must not change between renders.
 * @param reload Reads the page's data again.
 */
export const useDataChanges = (
  watch: WatchData | undefined,
  topics: readonly DataTopic[],
  reload: () => Promise<unknown> | void,
): void => {
  const reloadRef = useRef(reload);

  // The latest reload, set after render so a render is never what reads it.
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    if (watch === undefined) {
      return undefined;
    }

    let isRunning = false;
    let isAgainWanted = false;

    const run = async (): Promise<void> => {
      if (isRunning) {
        isAgainWanted = true;
        return;
      }

      isRunning = true;

      try {
        do {
          isAgainWanted = false;
          await reloadRef.current();
        } while (isAgainWanted);
      } finally {
        isRunning = false;
      }
    };

    return watch((changed) => {
      if (changed.some((topic) => topics.includes(topic))) {
        void run();
      }
    });
  }, [watch, topics]);
};

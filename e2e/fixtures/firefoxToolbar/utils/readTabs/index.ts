import { browser } from "@wdio/globals";
import * as v from "valibot";

import { buildTabsReaderScript } from "../buildTabsReaderScript";
import { type tabSnapshotSchema, tabsSnapshotSchema } from "./schemas";

export type TabSnapshot = v.InferOutput<typeof tabSnapshotSchema>;

/** Lists the current window's tabs. Must be called in the chrome context. */
export const readTabs = async (): Promise<TabSnapshot[]> => {
  const raw = await browser.executeScript(buildTabsReaderScript(), []);

  if (typeof raw !== "string") {
    throw new Error(`Expected the tabs as a JSON string, got ${typeof raw}.`);
  }

  return v.parse(tabsSnapshotSchema, JSON.parse(raw));
};

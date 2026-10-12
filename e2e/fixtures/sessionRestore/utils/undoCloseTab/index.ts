import { browser } from "@wdio/globals";

/**
 * Does what Ctrl+Shift+T does: reopens the window's most recently closed item —
 * a tab, or a whole group when a group was closed last. Must be called in the
 * chrome context.
 */
export const undoCloseTab = async (): Promise<void> => {
  await browser.executeScript("SessionWindowUI.undoCloseTab(window);", []);
};

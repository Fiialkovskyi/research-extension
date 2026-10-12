/**
 * Builds the privileged script that lists the window's tabs: each tab's
 * address, whether it is the selected one, and the label of its group, if any.
 *
 * Runs in the chrome context, so it reports what Firefox shows rather than
 * what the extension believes.
 */
export const buildTabsReaderScript = (): string => {
  return `return JSON.stringify(gBrowser.tabs.map((tab) => ({
      url: tab.linkedBrowser.currentURI.spec,
      selected: tab.selected,
      group: tab.group?.label ?? null,
    })));`;
};

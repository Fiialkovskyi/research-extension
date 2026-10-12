/**
 * Builds the privileged script that selects the first tab whose address ends
 * with `urlEnding`, the way clicking it in the tab strip would. It returns
 * whether such a tab was found.
 */
export const buildTabSelectorScript = (urlEnding: string): string => {
  return `const tab = gBrowser.tabs.find((candidate) =>
      candidate.linkedBrowser.currentURI.spec.endsWith(${JSON.stringify(urlEnding)}));
    if (!tab) { return false; }
    gBrowser.selectedTab = tab;
    return true;`;
};

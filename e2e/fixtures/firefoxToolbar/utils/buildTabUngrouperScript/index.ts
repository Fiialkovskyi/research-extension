/**
 * Builds the privileged script that takes the tab showing `url` out of its
 * group, the way dragging it out does, through Firefox's own `ungroupTab`.
 * Returns whether such a tab was found, as JSON.
 */
export const buildTabUngrouperScript = (url: string): string => {
  return `const tab = gBrowser.tabs.find((candidate) => candidate.linkedBrowser.currentURI.spec === ${JSON.stringify(url)});
    if (!tab) { return JSON.stringify(false); }
    gBrowser.ungroupTab(tab);
    return JSON.stringify(true);`;
};

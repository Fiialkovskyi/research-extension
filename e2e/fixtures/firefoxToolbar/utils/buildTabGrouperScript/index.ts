/**
 * Builds the privileged script that moves the tab showing `url` into the group
 * labelled `label`, the way dropping it on the group does.
 *
 * It goes through the group's own `addTabs`, the call Firefox's drag and drop
 * ends in, so the extension hears the same `tabs.onUpdated` it would from a
 * person. Returns whether both the tab and the group were found, as JSON.
 */
export const buildTabGrouperScript = (url: string, label: string): string => {
  return `const tab = gBrowser.tabs.find((candidate) => candidate.linkedBrowser.currentURI.spec === ${JSON.stringify(url)});
    const group = (gBrowser.tabGroups ?? []).find((candidate) => candidate.label === ${JSON.stringify(label)});
    if (!tab || !group) { return JSON.stringify(false); }
    group.addTabs([tab]);
    return JSON.stringify(true);`;
};

/**
 * Builds the privileged script that closes every tab of the group with the
 * given label, the way a user closing the group's last tab would.
 *
 * Runs in the chrome context through `gBrowser`, so Firefox removes the group
 * itself and fires the same events the extension hears from a person. Returns
 * how many tabs it closed, as JSON.
 */
export const buildTabGroupCloserScript = (label: string): string => {
  return `const group = (gBrowser.tabGroups ?? []).find((candidate) => candidate.label === ${JSON.stringify(label)});
    if (!group) { return JSON.stringify(0); }
    const tabs = [...group.tabs];
    gBrowser.removeTabs(tabs);
    return JSON.stringify(tabs.length);`;
};

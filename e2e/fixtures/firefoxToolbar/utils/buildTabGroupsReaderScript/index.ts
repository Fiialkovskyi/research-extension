/**
 * Builds the privileged script that lists the window's tab groups.
 *
 * Runs in the chrome context, where `gBrowser.tabGroups` is the browser's own
 * record of the groups — so the test checks what Firefox shows, not what the
 * extension believes it created. Returned as JSON, like every other value that
 * crosses the protocol here.
 */
export const buildTabGroupsReaderScript = (): string => {
  return `return JSON.stringify((gBrowser.tabGroups ?? []).map((group) => ({
      label: group.label,
      color: group.color,
      tabCount: group.tabs.length,
    })));`;
};

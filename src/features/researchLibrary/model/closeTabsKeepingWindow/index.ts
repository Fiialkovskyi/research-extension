/** The browser calls closing a saved session's tabs uses. */
export interface CloseTabsApi {
  /** Every tab id in a window. */
  queryWindowTabIds: (windowId: number) => Promise<number[]>;
  /** Opens a new tab in a window. */
  createTabIn: (windowId: number) => Promise<unknown>;
  removeTabs: (tabIds: number[]) => Promise<unknown>;
}

/**
 * Closes a saved session's tabs without closing their window: when they are
 * every tab of a window, a new tab is opened there first, as closing the last
 * tab of a window closes the window.
 */
export const closeTabsKeepingWindow = async (
  api: CloseTabsApi,
  tabs: readonly { id: number; windowId?: number }[],
): Promise<void> => {
  if (tabs.length === 0) {
    return;
  }

  const closing = new Set(tabs.map(({ id }) => id));
  const windowIds = [
    ...new Set(tabs.flatMap(({ windowId }) => (windowId === undefined ? [] : [windowId]))),
  ];

  for (const windowId of windowIds) {
    const remaining = (await api.queryWindowTabIds(windowId)).filter((id) => !closing.has(id));

    if (remaining.length === 0) {
      await api.createTabIn(windowId);
    }
  }

  await api.removeTabs([...closing]);
};

/**
 * The extension page the reader runs in. Any page of the extension shares its
 * origin, and so its database and its `browser.*` API; the options page is
 * used because opening it has no effect on the session.
 */
export const READER_PAGE_PATH = "options.html";

/** Chrome-context script that remembers the selected tab on the browser window. */
export const REMEMBER_SELECTED_TAB_SCRIPT =
  "window.__researchGraphSelectedTab = gBrowser.selectedTab;";

/** Chrome-context script that selects the remembered tab again, if it still exists. */
export const RESTORE_SELECTED_TAB_SCRIPT = `const tab = window.__researchGraphSelectedTab;
  delete window.__researchGraphSelectedTab;
  if (tab && gBrowser.tabs.includes(tab)) { gBrowser.selectedTab = tab; }`;

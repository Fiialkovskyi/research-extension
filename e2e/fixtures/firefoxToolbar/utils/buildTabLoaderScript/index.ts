/**
 * Builds the privileged script that loads a URL into the selected tab, the way
 * typing it into the address bar would.
 *
 * Runs in the chrome context: the session's tab is selected there, but it is
 * not the browsing context the content-side driver is attached to, so a
 * content-side `url()` would load the page into the wrong tab.
 */
export const buildTabLoaderScript = (url: string): string => {
  return `openTrustedLinkIn(${JSON.stringify(url)}, "current");`;
};

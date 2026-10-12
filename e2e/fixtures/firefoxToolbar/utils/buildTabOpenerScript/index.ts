/**
 * Builds the privileged script that opens a URL in a new tab outside any group,
 * without selecting it — a tab the user has open before deciding it belongs to
 * the research.
 */
export const buildTabOpenerScript = (url: string): string => {
  return `gBrowser.addTrustedTab(${JSON.stringify(url)});`;
};

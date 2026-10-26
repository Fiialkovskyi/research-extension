/**
 * Whether a node's title says nothing: blank, or only the page's address or
 * its host, which is what a tab shows while a page has no title of its own.
 */
export const isTitleMissing = (title: string, url: string): boolean => {
  const trimmed = title.trim();

  if (trimmed === "" || trimmed === url) {
    return true;
  }

  try {
    return trimmed === new URL(url).host;
  } catch {
    return false;
  }
};

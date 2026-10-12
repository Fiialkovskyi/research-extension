/**
 * Whether a page may become a node: only web pages, `http` or `https`.
 *
 * Browser pages (`about:`), the extension's own pages (`moz-extension:`), local
 * files and inline documents (`data:`) are never part of research (CAP-008).
 */
export const isCapturableUrl = (url: string | undefined): url is string => {
  if (url === undefined || !URL.canParse(url)) {
    return false;
  }

  const { protocol } = new URL(url);

  return protocol === "http:" || protocol === "https:";
};

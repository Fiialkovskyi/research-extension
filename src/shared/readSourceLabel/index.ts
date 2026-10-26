/**
 * Names a source for a link: the site its page gave of itself, else the host of
 * its address without `www.` — never the page's own title, which is written for
 * a search engine and not for a reader who knows where they are.
 */
export const readSourceLabel = ({
  siteName,
  url,
}: {
  siteName?: string | undefined;
  url: string;
}): string => {
  const site = siteName?.trim();

  if (site !== undefined && site !== "") {
    return site;
  }

  return URL.canParse(url) ? new URL(url).hostname.replace(/^www\./u, "") : url;
};

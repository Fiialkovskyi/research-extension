import { METADATA_CANONICAL_URL_LIMIT } from "../../../../constants";

/**
 * Reads the page's canonical address from its `<link rel="canonical">`,
 * resolved against the page.
 *
 * @returns An `http` or `https` address within the length limit, or
 *   `undefined` — a canonical link that is anything else is not kept.
 */
export const readCanonicalUrl = (document: Document): string | undefined => {
  const href = document.head.querySelector('link[rel="canonical"]')?.getAttribute("href");

  if (href === null || href === undefined || href.trim() === "") {
    return undefined;
  }

  try {
    const url = new URL(href.trim(), document.baseURI);

    return (url.protocol === "http:" || url.protocol === "https:") &&
      url.href.length <= METADATA_CANONICAL_URL_LIMIT
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

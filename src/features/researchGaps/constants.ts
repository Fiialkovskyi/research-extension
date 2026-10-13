/** The version of the host-to-category table, for anything that records it. */
export const DOMAIN_CATEGORIES_VERSION = "domainCategories@1";

/** What kind of source a page is, by its host (target spec §4, `domain_category`). */
export const DOMAIN_CATEGORIES = [
  "review",
  "forum",
  "video",
  "retailer",
  "reference",
  "news",
  "other",
] as const;

/**
 * Hosts by category, matched on the hostname without `www.`: exactly, as a
 * suffix after a dot, or — for an entry ending in `.*` — under any top-level
 * domain. Only hosts are matched, never paths. Bundled and versioned; a host
 * not listed is `other`.
 */
export const DOMAIN_CATEGORY_HOSTS = {
  review: [
    "rtings.com",
    "notebookcheck.net",
    "techradar.com",
    "tomsguide.com",
    "pcmag.com",
    "cnet.com",
    "electrek.co",
    "bikeradar.com",
    "ixbt.com",
    "itc.ua",
  ],
  forum: [
    "reddit.com",
    "stackexchange.com",
    "stackoverflow.com",
    "4pda.to",
    "quora.com",
    "hardforum.com",
  ],
  video: ["youtube.com", "youtu.be", "vimeo.com", "tiktok.com"],
  retailer: [
    "amazon.*",
    "ebay.*",
    "bestbuy.com",
    "walmart.com",
    "aliexpress.com",
    "rozetka.com.ua",
    "telemart.ua",
    "comfy.ua",
    "foxtrot.com.ua",
    "allo.ua",
    "citrus.ua",
    "hotline.ua",
    "prom.ua",
    "olx.ua",
  ],
  reference: ["wikipedia.org", "wikidata.org", "britannica.com"],
  news: ["bbc.com", "reuters.com", "theverge.com", "engadget.com", "arstechnica.com"],
} as const;

/** The categories whose absence is a gap: news and other say nothing about a comparison. */
export const GAP_CATEGORIES = ["review", "forum", "video", "retailer", "reference"] as const;

/** How a missing category reads, and the word a search for it adds. */
export const CATEGORY_GAP_TEXT = {
  review: { text: "No reviews read yet", word: "review" },
  forum: { text: "No forum discussions read yet", word: "forum" },
  video: { text: "No videos watched yet", word: "video review" },
  retailer: { text: "No shop pages read yet", word: "price" },
  reference: { text: "No reference pages read yet", word: "specifications" },
} as const;

/** The most cell gaps listed; the rest are counted. */
export const MAXIMUM_CELL_GAPS = 20;

/** The longest query a gap's search carries. */
export const MAXIMUM_QUERY_LENGTH = 120;

/** The engine a search uses when the session has made none. */
export const DEFAULT_SEARCH_ENGINE = "DuckDuckGo";

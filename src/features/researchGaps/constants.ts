/**
 * What a page declares about itself, by the kind of source it makes it: the
 * schema.org types of its JSON-LD (compared without case) and the start of its
 * `og:type`. Checked in this order, so a page with a forum post and an offer is
 * a forum. A public vocabulary, with no host, brand or language in it.
 */
export const SOURCE_KIND_SIGNALS = {
  forum: { schemaTypes: ["DiscussionForumPosting", "QAPage", "Question"], ogTypes: [] },
  video: { schemaTypes: ["VideoObject"], ogTypes: ["video"] },
  shop: { schemaTypes: ["Offer", "AggregateOffer"], ogTypes: ["product", "og:product"] },
  review: { schemaTypes: ["Review", "CriticReview", "UserReview"], ogTypes: [] },
} as const;

/** The kinds of source whose absence is a gap. */
export const GAP_CATEGORIES = ["shop", "review", "forum", "video"] as const;

/** How a missing kind reads, and the word a search for it adds. */
export const CATEGORY_GAP_TEXT = {
  shop: { text: "No shop pages read yet", word: "price" },
  review: { text: "No reviews read yet", word: "review" },
  forum: { text: "No forum discussions read yet", word: "forum" },
  video: { text: "No videos watched yet", word: "video review" },
} as const;

/**
 * A kind of source is reported missing only for a session of at least this many
 * pages (searches are not pages), at least half of them classified: with most
 * pages unclassified the kinds cannot be told.
 */
export const MINIMUM_CLASSIFIED_PAGES = 3;

/** The most entities whose missing values are listed; the rest are counted. */
export const MAXIMUM_CELL_GAPS = 5;

/** The most missing attributes one gap names; the rest are counted. */
export const MAXIMUM_GAP_ATTRIBUTES = 3;

/** The fewest facts, from at least two pages, a row needs for its missing values to count. */
export const MINIMUM_GAP_ROW_FACTS = 3;

/** The longest query a gap's search carries. */
export const MAXIMUM_QUERY_LENGTH = 120;

/** The engine a search uses when the session has made none. */
export const DEFAULT_SEARCH_ENGINE = "DuckDuckGo";

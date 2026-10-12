/**
 * One search engine whose results pages capture recognises.
 *
 * Matched on the hostname and pathname only: the scheme and port say nothing
 * about whether a page is a results page.
 */
export interface SearchEngine {
  name: string;
  /**
   * Hostnames, lowercase. One ending in `.*` stands for that name under any
   * top-level domain of one or two labels, such as `google.de` or
   * `google.co.uk`.
   */
  hosts: readonly string[];
  /** Pathnames of a results page, exactly. */
  resultPaths: readonly string[];
  /** URL parameters that carry the query, in order of preference. */
  queryParameters: readonly string[];
}

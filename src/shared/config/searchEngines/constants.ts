import type { SearchEngine } from "./types";

/**
 * The search engines whose results pages become SERP nodes (REQ-CAP-003).
 *
 * Bundled and versioned with the extension. A page an engine moves elsewhere
 * is recorded as a plain page until this table follows it: less informative,
 * never wrong.
 */
export const SEARCH_ENGINES: readonly SearchEngine[] = [
  {
    name: "Google",
    hosts: ["google.*", "www.google.*"],
    resultPaths: ["/search"],
    queryParameters: ["q"],
    searchUrl: "https://www.google.com/search?q={query}",
  },
  {
    name: "Bing",
    hosts: ["bing.com", "www.bing.com"],
    resultPaths: ["/search"],
    queryParameters: ["q"],
    searchUrl: "https://www.bing.com/search?q={query}",
  },
  {
    name: "DuckDuckGo",
    hosts: ["duckduckgo.com", "html.duckduckgo.com"],
    resultPaths: ["/", "/html", "/html/"],
    queryParameters: ["q"],
    searchUrl: "https://duckduckgo.com/?q={query}",
  },
  {
    name: "Startpage",
    hosts: ["startpage.com", "www.startpage.com"],
    resultPaths: ["/sp/search", "/do/search"],
    queryParameters: ["query", "q"],
    searchUrl: "https://www.startpage.com/sp/search?query={query}",
  },
  {
    name: "Ecosia",
    hosts: ["ecosia.org", "www.ecosia.org"],
    resultPaths: ["/search"],
    queryParameters: ["q"],
    searchUrl: "https://www.ecosia.org/search?q={query}",
  },
  {
    name: "Kagi",
    hosts: ["kagi.com"],
    resultPaths: ["/search"],
    queryParameters: ["q"],
    searchUrl: "https://kagi.com/search?q={query}",
  },
  {
    name: "Brave Search",
    hosts: ["search.brave.com"],
    resultPaths: ["/search"],
    queryParameters: ["q"],
    searchUrl: "https://search.brave.com/search?q={query}",
  },
];

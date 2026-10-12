import { join } from "node:path";

/** The pages the capture suite browses, served offline. */
// `import.meta.dirname` rather than a URL: under the unit runner's jsdom
// environment `import.meta.url` is not a `file:` URL, and specs that import the
// search hosts from here would fail to load.
export const PAGES_DIRECTORY = join(import.meta.dirname, "pages");

/**
 * Environment variable carrying the server's origin from the launcher, which
 * starts the server, to the workers, which inherit the launcher's environment.
 */
export const PAGE_ORIGIN_VARIABLE = "E2E_PAGE_ORIGIN";

/**
 * Search engine hosts the suite browses. The test profile resolves them to the
 * loopback interface, and the page server answers them with a results page, so
 * capture sees real search URLs without the suite going online.
 */
export const SEARCH_HOSTS = ["duckduckgo.com", "www.bing.com"] as const;

import { CAPTURE_DENYLIST } from "@/shared/config";

import { isDenylistedHost } from "../isDenylistedHost";

/**
 * The host of a web page the capture denylist refuses (REQ-SEC-007), or
 * `undefined` for any other URL — a page that may be recorded, and equally a
 * page that is not a web page at all (`about:`, an extension page, a local
 * file), which is not "blocked" but simply not research.
 *
 * Matches exactly the hosts `isCapturableUrl` refuses for being denylisted,
 * the bundled list and the user's own sites alike.
 */
export const readBlockedHost = (
  url: string | undefined,
  blockedSites: readonly string[] = [],
): string | undefined => {
  if (url === undefined || !URL.canParse(url)) {
    return undefined;
  }

  const { protocol, hostname } = new URL(url);

  if (protocol !== "http:" && protocol !== "https:") {
    return undefined;
  }

  const isBlocked =
    isDenylistedHost(hostname, CAPTURE_DENYLIST) ||
    isDenylistedHost(hostname, {
      version: CAPTURE_DENYLIST.version,
      categories: [{ name: "user", domains: blockedSites, suffixes: [], words: [] }],
    });

  return isBlocked ? hostname.toLowerCase().replace(/\.$/, "") : undefined;
};

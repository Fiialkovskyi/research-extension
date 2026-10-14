import { CAPTURE_DENYLIST } from "@/shared/config";

import { isDenylistedHost } from "../isDenylistedHost";

/**
 * Whether a page may become a node: only a web page, `http` or `https`, on a
 * host that is not on the capture denylist.
 *
 * Browser pages (`about:`), the extension's own pages (`moz-extension:`), local
 * files and inline documents (`data:`) are never part of research, and nor are
 * banking, health, government, webmail or password-manager pages (CAP-008,
 * SEC-007). Every recording path asks this, and everything else capture keeps —
 * signals, reading time, the page observer, snapshots — hangs off a node, so a
 * page refused here leaves no trace.
 *
 * @param blockedSites The sites the user added to the denylist, matched with
 *   their subdomains as the bundled list's domains are.
 */
export const isCapturableUrl = (
  url: string | undefined,
  blockedSites: readonly string[] = [],
): url is string => {
  if (url === undefined || !URL.canParse(url)) {
    return false;
  }

  const { protocol, hostname } = new URL(url);

  return (
    (protocol === "http:" || protocol === "https:") &&
    !isDenylistedHost(hostname, CAPTURE_DENYLIST) &&
    !isDenylistedHost(hostname, {
      version: CAPTURE_DENYLIST.version,
      categories: [{ name: "user", domains: blockedSites, suffixes: [], words: [] }],
    })
  );
};

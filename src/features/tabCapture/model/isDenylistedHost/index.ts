import type { CaptureDenylist } from "@/shared/config";

import { isEngineHost } from "../isEngineHost";

/** `host` and each host it is a subdomain of: `a.b.com`, `b.com`, `com`. */
const listHostAndParents = (host: string): string[] => {
  const labels = host.split(".");

  return labels.map((_, index) => labels.slice(index).join("."));
};

/**
 * Whether a host is on the capture denylist (REQ-SEC-007): it is a listed
 * domain or a subdomain of one, it falls under a listed suffix, or one of its
 * labels contains a listed word.
 *
 * Compared label by label, never as a substring of the whole host, so
 * `purchase.com` is not taken for `chase.com`. Case and a trailing dot are
 * ignored; the scheme and port are not part of a hostname.
 */
export const isDenylistedHost = (hostname: string, denylist: CaptureDenylist): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const hosts = listHostAndParents(host);
  const labels = host.split(".");

  return denylist.categories.some(
    ({ domains, suffixes, words }) =>
      domains.some((domain) => hosts.some((candidate) => isEngineHost(candidate, domain))) ||
      suffixes.some((suffix) => hosts.includes(suffix)) ||
      words.some((word) => labels.some((label) => label.includes(word))),
  );
};

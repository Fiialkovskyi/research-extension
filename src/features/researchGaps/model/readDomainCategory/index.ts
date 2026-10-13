import { DOMAIN_CATEGORY_HOSTS } from "../../constants";
import type { DomainCategory } from "../../types";

/** Whether a hostname is a listed host, a subdomain of it, or it under any top-level domain. */
const isListedHost = (hostname: string, listed: string): boolean => {
  if (listed.endsWith(".*")) {
    const name = listed.slice(0, -1);

    return hostname.startsWith(name) || hostname.includes(`.${name}`);
  }

  return hostname === listed || hostname.endsWith(`.${listed}`);
};

/**
 * Sorts a page's host into a source category (`domainCategories@1`): the
 * bundled table first, then forum hosts by their name; anything else is
 * `other`.
 */
export const readDomainCategory = (hostname: string): DomainCategory => {
  const host = hostname.toLowerCase().replace(/^www\./u, "");
  const listed = (
    Object.entries(DOMAIN_CATEGORY_HOSTS) as [DomainCategory, readonly string[]][]
  ).find(([, hosts]) => hosts.some((candidate) => isListedHost(host, candidate)));

  if (listed !== undefined) {
    return listed[0];
  }

  return /(^|\.)(forums?|community)\./u.test(host) ? "forum" : "other";
};

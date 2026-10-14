/** An IPv4 address, or anything bracketed as IPv6 by `URL`. */
const IP_ADDRESS = /^(?:\d{1,3}(?:\.\d{1,3}){3}|\[[^\]]*\])$/u;

/**
 * Reads the site a user typed or pasted (REQ-SEC-007): a host such as
 * `example.org`, or any URL on it. The host is lowercased, and a trailing dot
 * and a leading `www.` dropped, so the entry covers the site's subdomains,
 * `www` among them.
 *
 * @returns The host to store, or `undefined` for input that names no site:
 *   unparseable, an IP address, a host with no dot, or one over 253 characters.
 */
export const parseBlockedSite = (input: string): string | undefined => {
  const trimmed = input.trim();

  if (trimmed === "" || /\s/u.test(trimmed)) {
    return undefined;
  }

  const candidate = /^[a-z][a-z\d+.-]*:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;

  if (!URL.canParse(candidate)) {
    return undefined;
  }

  const host = new URL(candidate).hostname
    .toLowerCase()
    .replace(/\.$/u, "")
    .replace(/^www\./u, "");

  if (host.length > 253 || !host.includes(".") || IP_ADDRESS.test(host)) {
    return undefined;
  }

  return host;
};

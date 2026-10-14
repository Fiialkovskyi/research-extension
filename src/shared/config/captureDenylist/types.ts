/** The kinds of page the capture denylist keeps out of every session (REQ-SEC-007). */
export type DenylistCategoryName =
  | "banking"
  | "health"
  | "government"
  | "webmail"
  | "passwordManagers"
  /** The sites the user added; never part of the bundled list. */
  | "user";

/**
 * One category of sensitive pages, by host.
 *
 * All entries are lowercase hostnames or parts of one, with no scheme, port,
 * path or leading dot.
 */
export interface DenylistCategory {
  name: DenylistCategoryName;
  /**
   * Hosts listed with every subdomain. One ending in `.*` stands for that name
   * under any top-level domain of one or two labels, such as `hsbc.de` or
   * `hsbc.co.uk`.
   */
  domains: readonly string[];
  /** Domain suffixes every host under which is listed, such as `gov` or `gov.uk`. */
  suffixes: readonly string[];
  /** Words that list any host one of whose labels contains them, such as `bank`. */
  words: readonly string[];
}

/** The bundled denylist: a version, raised with every edit, and its categories. */
export interface CaptureDenylist {
  version: string;
  categories: readonly DenylistCategory[];
}

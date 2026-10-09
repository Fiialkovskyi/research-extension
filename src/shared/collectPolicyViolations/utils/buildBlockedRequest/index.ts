import { readOrigin } from "../readOrigin";

/** The part of a policy-violation event this collector reads. */
export interface PolicyViolation {
  blockedURI?: string;
  violatedDirective?: string;
}

/** One blocked request, as the policy reported it. */
export interface BlockedRequest {
  origin: string;
  directive: string;
}

/**
 * Turns a raw policy-violation event into something worth recording, or nothing.
 *
 * Owns the two defensive defaults and the one rejection, so the collector is
 * left with only the question of deduplication. Both defaults exist because the
 * event is a platform value we do not construct: a report with no directive is
 * named `unknown` rather than dropped, since the origin alone is still useful.
 *
 * A report with no blocked URI at all yields nothing. There is no host to name
 * and nothing to act on, so recording it would only pad the list.
 */
export const buildBlockedRequest = (event: PolicyViolation): BlockedRequest | undefined => {
  const origin = readOrigin(event.blockedURI ?? "");

  return origin === "" ? undefined : { origin, directive: event.violatedDirective ?? "unknown" };
};

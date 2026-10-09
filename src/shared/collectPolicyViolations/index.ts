import {
  type BlockedRequest,
  buildBlockedRequest,
  type PolicyViolation,
} from "./utils/buildBlockedRequest";

export type { BlockedRequest, PolicyViolation };

/** Where violations are reported. A document in practice; anything listenable in tests. */
export interface ViolationTarget {
  addEventListener: (type: string, listener: (event: PolicyViolation) => void) => void;
}

/** Reads what has been blocked so far. */
export interface PolicyViolationLog {
  read: () => BlockedRequest[];
}

/**
 * Records what the content security policy blocks, for diagnosis.
 *
 * The policy is the enforcement point for the no-egress guarantee, so the
 * interesting question during development is not whether it is active but
 * *what it stopped*. A blocked request is otherwise close to invisible: the
 * fetch simply fails, and the reason appears only in a console nobody is
 * watching.
 *
 * Deduplicated by origin and directive, because one install makes many requests
 * to the same host and a list of two hundred identical entries hides the one
 * that matters. Deciding what is worth recording at all belongs to
 * {@link buildBlockedRequest}; this function only keeps the first of each.
 *
 * Attach it in the context that makes the requests. Violations are reported
 * where they occur, so a listener on a surface would never see what the
 * background was refused.
 */
export const collectPolicyViolations = (target: ViolationTarget): PolicyViolationLog => {
  const blocked = new Map<string, BlockedRequest>();

  target.addEventListener("securitypolicyviolation", (event) => {
    const request = buildBlockedRequest(event);

    if (request === undefined) {
      return;
    }

    const key = `${request.directive} ${request.origin}`;

    if (!blocked.has(key)) {
      blocked.set(key, request);
    }
  });

  return { read: () => [...blocked.values()] };
};

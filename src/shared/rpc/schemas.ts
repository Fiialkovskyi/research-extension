import * as v from "valibot";

import { RPC_REJECTIONS } from "./constants";

/**
 * Answers about the protocol itself rather than about any feature's work.
 *
 * Owned here, not by a feature, because they can answer any request: a message
 * the receiver could not trust says nothing about which feature it was meant
 * for. Every surface admits them alongside the features' own responses.
 */
export const rpcResponseSchemas = {
  /**
   * The request was not accepted: not an envelope, a version this build does
   * not speak, a type no feature owns, or a payload its schema refused.
   */
  "rpc.refused": v.object({
    rejection: v.picklist(RPC_REJECTIONS),
    reason: v.string(),
  }),
  /**
   * The request was accepted, but handling it failed in a way its own feature
   * did not answer for. A bug rather than an expected outcome, reported so the
   * surface is never left waiting for a reply.
   */
  "rpc.failed": v.object({
    requestType: v.string(),
    reason: v.string(),
  }),
} as const;

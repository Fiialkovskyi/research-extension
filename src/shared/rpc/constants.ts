/**
 * Protocol constants shared by the builder and the parser.
 */

/**
 * Envelope version. Every message carries it, and a receiver rejects anything
 * else rather than guessing at an older or newer shape.
 */
export const RPC_VERSION = 1;

/**
 * Every reason a message can be refused, in the order the parser checks them.
 *
 * A value rather than only a type, because the refusal is itself sent over the
 * wire (`rpc.refused`) and its schema needs the closed set.
 */
export const RPC_REJECTIONS = [
  "not-an-envelope",
  "unsupported-version",
  "unknown-type",
  "invalid-payload",
] as const;

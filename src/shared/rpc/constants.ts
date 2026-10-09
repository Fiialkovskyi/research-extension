/**
 * Protocol constants shared by the builder and the parser.
 */

/**
 * Envelope version. Every message carries it, and a receiver rejects anything
 * else rather than guessing at an older or newer shape.
 */
export const RPC_VERSION = 1;

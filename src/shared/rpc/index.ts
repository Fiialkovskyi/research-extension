/**
 * The envelope every context speaks: `{ v, type, id, payload }`.
 *
 * Generic on purpose. Each feature supplies the schemas for the messages it
 * owns, so this module never needs to know the full set — which is what keeps
 * `shared` from having to know about every feature.
 *
 * Everything arriving over a port or a one-shot message is untrusted: another
 * extension, or a bug of our own, can send any shape at all. So the envelope,
 * the version and the payload are each validated before a handler sees the
 * value, and anything unrecognised is refused rather than passed along.
 */

export { buildRpcMessage } from "./buildRpcMessage";
export type { RpcMessage } from "./buildRpcMessage";
export { RPC_VERSION } from "./constants";
export { parseRpcMessage, RpcMessageError } from "./parseRpcMessage";
export { readMessageField } from "./readMessageField";
export type { ParsedRpcMessage, RpcRejection, RpcSchemaMap } from "./parseRpcMessage";

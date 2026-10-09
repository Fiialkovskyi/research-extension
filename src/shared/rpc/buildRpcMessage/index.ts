import { RPC_VERSION } from "../constants";

/**
 * A message crossing a context boundary.
 *
 * Every context talks to the background through this envelope, so a receiver
 * can check the version and dispatch on the type before trusting a payload.
 */
export interface RpcMessage<TType extends string, TPayload> {
  readonly v: typeof RPC_VERSION;
  readonly type: TType;
  readonly id: string;
  readonly payload: TPayload;
}

/**
 * Wraps a payload in an envelope with a fresh correlation id.
 *
 * The id lets a caller match a reply to its request over a port, where
 * several requests may be outstanding and replies can arrive out of order.
 */
export const buildRpcMessage = <const TType extends string, TPayload>(
  type: TType,
  payload: TPayload,
): RpcMessage<TType, TPayload> => {
  return { v: RPC_VERSION, type, id: crypto.randomUUID(), payload };
};

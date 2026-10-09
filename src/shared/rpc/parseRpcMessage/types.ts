import type * as v from "valibot";

import type { RpcMessage } from "../buildRpcMessage";
import type { RPC_REJECTIONS } from "../constants";

/**
 * Payload schemas keyed by message type.
 *
 * Each feature supplies the schemas for the messages it owns, so `shared` never
 * needs to know the full set. A type absent from the map is unknown by
 * definition and is rejected.
 */
export type RpcSchemaMap = Record<string, v.GenericSchema>;

/** The messages a given schema map admits, as a discriminated union. */
export type ParsedRpcMessage<TSchemas extends RpcSchemaMap> = {
  [TType in keyof TSchemas & string]: RpcMessage<TType, v.InferOutput<TSchemas[TType]>>;
}[keyof TSchemas & string];

/** Why a message was refused. Carried so a receiver can reply usefully. */
export type RpcRejection = (typeof RPC_REJECTIONS)[number];

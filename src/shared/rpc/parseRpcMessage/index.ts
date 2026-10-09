import * as v from "valibot";

import type { RpcMessage } from "../buildRpcMessage";
import { type RPC_REJECTIONS, RPC_VERSION } from "../constants";

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

/** Raised when a candidate message cannot be trusted. */
export class RpcMessageError extends Error {
  constructor(
    readonly rejection: RpcRejection,
    message: string,
  ) {
    super(message);
    this.name = "RpcMessageError";
  }
}

const envelopeSchema = v.object({
  v: v.number(),
  type: v.string(),
  id: v.string(),
  payload: v.unknown(),
});

/**
 * Validates an untrusted value as a message the given schema map admits.
 *
 * Everything arriving over a port or a one-shot message is untrusted: another
 * extension, or a bug in our own code, can send any shape at all. So the
 * envelope, the version and the payload are each checked before a handler sees
 * the value, and anything unrecognised is refused rather than passed along.
 *
 * @throws {RpcMessageError} when the value is not a message this map admits.
 */
export const parseRpcMessage = <TSchemas extends RpcSchemaMap>(
  candidate: unknown,
  schemas: TSchemas,
): ParsedRpcMessage<TSchemas> => {
  const envelope = v.safeParse(envelopeSchema, candidate);

  if (!envelope.success) {
    throw new RpcMessageError("not-an-envelope", "Message is not an RPC envelope");
  }

  if (envelope.output.v !== RPC_VERSION) {
    throw new RpcMessageError(
      "unsupported-version",
      `Unsupported RPC version ${envelope.output.v}; this build speaks ${RPC_VERSION}`,
    );
  }

  const payloadSchema = Object.hasOwn(schemas, envelope.output.type)
    ? schemas[envelope.output.type]
    : undefined;

  if (payloadSchema === undefined) {
    throw new RpcMessageError("unknown-type", `Unknown message type "${envelope.output.type}"`);
  }

  const payload = v.safeParse(payloadSchema, envelope.output.payload);

  if (!payload.success) {
    throw new RpcMessageError(
      "invalid-payload",
      `Payload for "${envelope.output.type}" is invalid: ${payload.issues[0]?.message ?? "unknown issue"}`,
    );
  }

  return {
    v: RPC_VERSION,
    type: envelope.output.type,
    id: envelope.output.id,
    payload: payload.output,
  } as ParsedRpcMessage<TSchemas>;
};

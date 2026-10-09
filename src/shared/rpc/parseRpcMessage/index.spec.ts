import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { RpcMessageError, parseRpcMessage } from ".";
import { buildRpcMessage } from "../buildRpcMessage";
import { RPC_VERSION } from "../constants";

const schemas = {
  "model.install": v.object({ repository: v.string() }),
  "worker.ping": v.object({}),
};

/** The rejection reason, or the symbol below when nothing was thrown. */
const didNotThrow = Symbol("did not throw");

const rejectionOf = (candidate: unknown): string | typeof didNotThrow => {
  try {
    parseRpcMessage(candidate, schemas);
    return didNotThrow;
  } catch (error) {
    if (error instanceof RpcMessageError) {
      return error.rejection;
    }

    throw error;
  }
};

describe("parseRpcMessage", () => {
  it("accepts a message the schema map admits", () => {
    const sent = buildRpcMessage("model.install", { repository: "owner/model" });

    const received = parseRpcMessage(structuredClone(sent), schemas);

    expect(received).toEqual(sent);
  });

  it("preserves the correlation id, so a reply can be matched to its request", () => {
    const sent = buildRpcMessage("worker.ping", {});

    expect(parseRpcMessage(structuredClone(sent), schemas).id).toBe(sent.id);
  });

  it.each([
    ["a primitive", 42],
    ["null", null],
    ["an array", []],
    ["an object missing the envelope fields", { type: "worker.ping" }],
  ])("refuses %s as not an envelope", (_label, candidate) => {
    expect(rejectionOf(candidate)).toBe("not-an-envelope");
  });

  it("refuses a version this build does not speak", () => {
    const candidate = { v: RPC_VERSION + 1, type: "worker.ping", id: "a", payload: {} };

    expect(rejectionOf(candidate)).toBe("unsupported-version");
  });

  it("refuses a type absent from the schema map", () => {
    const candidate = { v: RPC_VERSION, type: "session.start", id: "a", payload: {} };

    expect(rejectionOf(candidate)).toBe("unknown-type");
  });

  it("refuses a payload that does not match its schema", () => {
    const candidate = {
      v: RPC_VERSION,
      type: "model.install",
      id: "a",
      payload: { repository: 7 },
    };

    expect(rejectionOf(candidate)).toBe("invalid-payload");
  });

  it("does not treat an inherited property as a known type", () => {
    // `{}.toString` exists on every object, so a plain `schemas[type]` lookup
    // would resolve it and hand a function to the payload check.
    const candidate = { v: RPC_VERSION, type: "toString", id: "a", payload: {} };

    expect(rejectionOf(candidate)).toBe("unknown-type");
  });

  it("names the offending type in the error, so a receiver can report it", () => {
    const candidate = { v: RPC_VERSION, type: "session.start", id: "a", payload: {} };

    expect(() => parseRpcMessage(candidate, schemas)).toThrow(/session\.start/);
  });
});

import { describe, expect, it } from "vitest";

import { buildRpcMessage } from ".";
import { RPC_VERSION } from "../constants";

describe("buildRpcMessage", () => {
  it("stamps the current protocol version", () => {
    expect(buildRpcMessage("model.install", {}).v).toBe(RPC_VERSION);
  });

  it("carries the type and payload through unchanged", () => {
    const payload = { repository: "owner/model" };

    const message = buildRpcMessage("model.install", payload);

    expect(message.type).toBe("model.install");
    expect(message.payload).toEqual(payload);
  });

  it("gives every message a distinct id, so concurrent replies can be matched", () => {
    const ids = Array.from({ length: 50 }, () => buildRpcMessage("worker.ping", {}).id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produces an id that survives being sent as structured data", () => {
    const { id } = buildRpcMessage("worker.ping", {});

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});

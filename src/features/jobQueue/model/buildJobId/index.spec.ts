import { describe, expect, it } from "vitest";

import { buildJobId } from ".";

const identity = { type: "embed", inputHashes: ["a", "b"], producerVersion: "model@1" };

describe("buildJobId", () => {
  it("is a SHA-256 in hex, the same for the same work", async () => {
    const id = await buildJobId(identity);

    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(await buildJobId(identity)).toBe(id);
  });

  it("does not depend on the order of the inputs", async () => {
    expect(await buildJobId({ ...identity, inputHashes: ["b", "a"] })).toBe(
      await buildJobId(identity),
    );
  });

  it("differs for another producer version, type or input", async () => {
    const id = await buildJobId(identity);

    expect(await buildJobId({ ...identity, producerVersion: "model@2" })).not.toBe(id);
    expect(await buildJobId({ ...identity, type: "extract" })).not.toBe(id);
    expect(await buildJobId({ ...identity, inputHashes: ["a"] })).not.toBe(id);
  });
});

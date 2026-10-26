import { describe, expect, it, vi } from "vitest";

import { resolveConceptKeys } from ".";

/** An embedder over hand-made two-dimensional vectors, by concept; unknown ones are far from all. */
const embedWith =
  (vectors: Record<string, [number, number]>) =>
  (texts: readonly string[]): Promise<Float32Array[]> =>
    Promise.resolve(texts.map((text) => Float32Array.from(vectors[text] ?? [0, -1])));

describe("resolveConceptKeys", () => {
  it("gives equal concepts, however written, one key, with no embedding", async () => {
    const keys = await resolveConceptKeys(["Battery  Capacity", "battery capacity", "weight"]);

    expect(keys.get("Battery  Capacity")).toBe("battery capacity");
    expect(keys.get("battery capacity")).toBe("battery capacity");
    expect(keys.get("weight")).toBe("weight");
  });

  it("merges similar concepts into the commonest, with an embedding model", async () => {
    const embed = embedWith({ weight: [1, 0], mass: [0.99, 0.1] });
    const keys = await resolveConceptKeys(["weight", "weight", "mass"], embed);

    expect(keys.get("mass")).toBe("weight");
    expect(keys.get("weight")).toBe("weight");
  });

  it("keeps different things apart", async () => {
    const embed = embedWith({ "battery life": [1, 0], "battery capacity": [0.5, 0.87] });
    const keys = await resolveConceptKeys(["battery life", "battery capacity"], embed);

    expect(keys.get("battery capacity")).toBe("battery capacity");
  });

  it("does not merge similar concepts without an embedding model", async () => {
    const keys = await resolveConceptKeys(["weight", "mass"]);

    expect(keys.get("mass")).toBe("mass");
  });

  it("does not chain: a concept joins a representative, never another member", async () => {
    // a~b and b~c are close, a~c is not: c must not follow b into a's column.
    const embed = embedWith({ a: [1, 0], b: [0.927, 0.375], c: [0.719, 0.695] });
    const keys = await resolveConceptKeys(["a", "a", "a", "b", "b", "c"], embed);

    expect(keys.get("b")).toBe("a");
    expect(keys.get("c")).toBe("c");
  });

  it("falls back to the equal ones when the embedding fails or answers short", async () => {
    const failing = vi.fn(() => Promise.reject(new Error("offline")));
    const short = vi.fn((texts: readonly string[]) =>
      Promise.resolve(texts.slice(1).map(() => Float32Array.of(1, 0))),
    );

    expect((await resolveConceptKeys(["weight", "mass"], failing)).get("mass")).toBe("mass");
    expect((await resolveConceptKeys(["weight", "mass"], short)).get("mass")).toBe("mass");
  });

  it("embeds only the concept labels, each once", async () => {
    const embed = vi.fn(embedWith({}));

    await resolveConceptKeys(["pile height", "Pile height", "weight"], embed);

    expect(embed).toHaveBeenCalledTimes(1);
    expect([...(embed.mock.calls[0]?.[0] ?? [])].toSorted()).toEqual(["pile height", "weight"]);
  });
});

import { describe, expect, it } from "vitest";

import { type EntityCandidate, matchEntity } from ".";

const entity = (
  id: string,
  name: string,
  type = "product",
  overrides: Partial<EntityCandidate> = {},
) => ({
  id,
  name,
  type,
  isSeparated: false,
  ...overrides,
});

describe("matchEntity", () => {
  it("matches a name written differently, of the same type", () => {
    expect(
      matchEntity({ name: "macbook neo 13", type: "product" }, [entity("a", 'MacBook Neo 13"')]),
    ).toEqual({ kind: "name", entityId: "a" });
  });

  it("matches by name when either side's type is unknown", () => {
    expect(matchEntity({ name: "Volta E5", type: "unknown" }, [entity("a", "Volta E5")])).toEqual({
      kind: "name",
      entityId: "a",
    });
    expect(
      matchEntity({ name: "Volta E5", type: "product" }, [entity("a", "Volta E5", "unknown")]),
    ).toEqual({ kind: "name", entityId: "a" });
  });

  it("does not match the same name of another type", () => {
    expect(
      matchEntity({ name: "Apple", type: "fruit" }, [entity("a", "Apple", "company")]),
    ).toEqual({ kind: "new" });
  });

  it("merges by meaning into the most similar entity of the same type at the threshold or above", () => {
    const entities = [
      entity("air", "MacBook Air 13"),
      entity("neo", "Apple MacBook Neo 13 A18 Pro"),
      entity("shop", "Telemart", "company"),
    ];
    const scores: Record<string, number> = { air: 0.86, neo: 0.91, shop: 0.99 };

    expect(
      matchEntity({ name: "MacBook Neo 13", type: "product" }, entities, (id) => scores[id]),
    ).toEqual({ kind: "meaning", entityId: "neo", similarity: 0.91 });
  });

  it("makes a new entity below the threshold", () => {
    expect(
      matchEntity(
        { name: "MacBook Neo 13", type: "product" },
        [entity("air", "MacBook Air")],
        () => 0.8,
      ),
    ).toEqual({ kind: "new" });
  });

  it("makes a new entity without an embedding model", () => {
    expect(matchEntity({ name: "Neo", type: "product" }, [entity("a", "MacBook")])).toEqual({
      kind: "new",
    });
  });

  it("joins a merged entity by its own name, rather than merging the name again", () => {
    const entities = [
      entity("root", "Apple MacBook Neo 13"),
      entity("child", "MacBook Neo 13", "product", { mergedInto: "root" }),
    ];

    expect(matchEntity({ name: "MacBook Neo 13", type: "product" }, entities, () => 0.9)).toEqual({
      kind: "name",
      entityId: "child",
    });
  });

  it("merges by meaning only into roots, never into an entity merged into another", () => {
    const entities = [
      entity("root", "Apple MacBook Neo 13"),
      entity("child", "MacBook Neo 13", "product", { mergedInto: "root" }),
    ];

    expect(matchEntity({ name: "Neo 13 laptop", type: "product" }, entities, () => 0.9)).toEqual({
      kind: "meaning",
      entityId: "root",
      similarity: 0.9,
    });
  });

  it("does not match a subject of unknown type by meaning", () => {
    expect(
      matchEntity({ name: "Neo", type: "unknown" }, [entity("a", "MacBook")], () => 0.99),
    ).toEqual({ kind: "new" });
  });
});

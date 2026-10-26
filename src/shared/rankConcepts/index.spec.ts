import { describe, expect, it } from "vitest";

import { rankConcepts } from ".";
import type { ConceptFact } from "./types";

const fact = (key: string, entityId: string, pageId: string, value: string): ConceptFact => ({
  key,
  entityId,
  pageId,
  value,
});

const keysOf = (facts: readonly ConceptFact[], onlySpecs = false): string[] =>
  rankConcepts(facts)
    .filter(({ isSpec }) => isSpec || !onlySpecs)
    .map(({ key }) => key);

describe("rankConcepts", () => {
  it("puts what more products state before what fewer do", () => {
    const facts = [
      fact("care label", "a", "p1", "hand wash"),
      fact("pile height", "a", "p1", "12 mm"),
      fact("pile height", "b", "p2", "20 mm"),
      fact("pile height", "c", "p3", "20 mm"),
      fact("care label", "b", "p2", "machine wash"),
    ];

    expect(keysOf(facts)).toEqual(["pile height", "care label"]);
  });

  it("ranks a single product's concepts by pages, then by the shorter value", () => {
    const facts = [
      fact("weight", "a", "p1", "190 g"),
      fact("weight", "a", "p2", "190 g"),
      fact("weight", "a", "p3", "190 g"),
      fact("colour", "a", "p1", "red"),
      fact("finish", "a", "p1", "a very long finish name"),
    ];

    expect(keysOf(facts)).toEqual(["weight", "colour", "finish"]);
  });

  it("does not take prose for a spec, in any language", () => {
    const prose = "Цей килимок виготовлений з м'якого мікрофібрового волокна для ванної кімнати";
    const facts = [
      fact("опис", "a", "p1", prose),
      fact("опис", "b", "p2", prose.replace("м", "М")),
    ];

    expect(rankConcepts(facts)[0]?.isSpec).toBe(false);
  });

  it("does not take what is the same on every entity for a spec", () => {
    const facts = [
      fact("category", "a", "p1", "bath mat"),
      fact("category", "b", "p2", "Bath  Mat"),
      fact("category", "c", "p3", "bath mat"),
    ];

    expect(rankConcepts(facts)[0]?.isSpec).toBe(false);
  });

  it("keeps a concept whose values tell entities apart", () => {
    const facts = [
      fact("pile height", "a", "p1", "12 mm"),
      fact("pile height", "b", "p2", "20 mm"),
      fact("pile height", "c", "p3", "20 mm"),
    ];

    expect(rankConcepts(facts)[0]?.isSpec).toBe(true);
  });

  it("does not take what only one of several entities states for a spec", () => {
    const facts = [
      fact("warranty note", "a", "p1", "2 years"),
      fact("weight", "a", "p1", "1 kg"),
      fact("weight", "b", "p2", "2 kg"),
    ];

    expect(keysOf(facts, true)).toEqual(["weight"]);
  });

  it("keeps a concept of a single entity when it is the only entity", () => {
    expect(keysOf([fact("warranty note", "a", "p1", "2 years")], true)).toEqual(["warranty note"]);
  });

  it("breaks a full tie by key", () => {
    const facts = [fact("b", "a", "p1", "x"), fact("a", "a", "p1", "y")];

    expect(keysOf(facts)).toEqual(["a", "b"]);
  });
});

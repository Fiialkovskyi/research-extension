import * as v from "valibot";

/** A fact a reader would take from a page: what it is about, and the value as the page writes it. */
const labelledFactSchema = v.object({
  concept: v.string(),
  value: v.string(),
});

/** Two concepts named in English, as the extraction prompt names them. */
const conceptPairSchema = v.tuple([v.string(), v.string()]);

export const labelsSchema = v.object({
  facts: v.array(labelledFactSchema),
  /** Pairs of concepts that mean the same, which one column should hold. */
  sameConcept: v.array(conceptPairSchema),
  /** Pairs of concepts that only look alike, which must stay in separate columns. */
  differentConcept: v.array(conceptPairSchema),
  /** The products the page is about, as a reader would name them. */
  products: v.array(v.string()),
});

export const fixtureMetaSchema = v.object({
  url: v.string(),
  savedOn: v.string(),
});

export const baselineSchema = v.record(v.string(), v.nullable(v.number()));

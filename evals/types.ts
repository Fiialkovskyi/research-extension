import type * as v from "valibot";

import type { METRIC_LABELS } from "./constants";
import type { baselineSchema, fixtureMetaSchema, labelsSchema } from "./schemas";

export type Labels = v.InferOutput<typeof labelsSchema>;
export type LabelledFact = Labels["facts"][number];
export type FixtureMeta = v.InferOutput<typeof fixtureMetaSchema>;
export type Baseline = v.InferOutput<typeof baselineSchema>;

/** A run's numbers; `null` where there was nothing to measure them on. */
export type Metrics = Record<keyof typeof METRIC_LABELS, number | null>;

/** A saved page with its source and what a reader would take from it. */
export interface Fixture {
  id: string;
  html: string;
  meta: FixtureMeta;
  labels: Labels;
}

/** A fixture the run cannot use, and why. */
export interface SkippedFixture {
  id: string;
  reason: string;
}

/** What one run found beyond its numbers, for the person reading the report. */
export interface RunDetails {
  fixtures: {
    id: string;
    answered: number;
    kept: number;
    missing: LabelledFact[];
    /** Each kept fact as `subject | attribute | concept | value unit`. */
    facts: string[];
  }[];
  cards: string[];
  statements: string[];
}

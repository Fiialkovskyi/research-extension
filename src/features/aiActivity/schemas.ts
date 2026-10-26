import * as v from "valibot";

const countSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

/** What AI has finished for the active session; a kind with nothing finished is absent. */
export const sessionTotalsSchema = v.object({
  pagesRead: v.optional(countSchema),
  factsFrom: v.optional(countSchema),
  summaries: v.optional(countSchema),
});

/** What the popup's strip shows, already decided: the popup words it and derives nothing. */
export const activityStateSchema = v.variant("kind", [
  v.object({
    kind: v.literal("paused"),
    /** Jobs that will run once the local server answers again. */
    waiting: countSchema,
    failed: countSchema,
  }),
  v.object({
    kind: v.literal("working"),
    label: v.string(),
    settled: countSchema,
    total: countSchema,
    /** When the running job was claimed; absent while only retries wait their turn. */
    startedAt: v.optional(v.number()),
    failed: countSchema,
  }),
  v.object({
    kind: v.literal("waiting"),
    /** Jobs held back until the user steps away. */
    waiting: countSchema,
    failed: countSchema,
  }),
  v.object({
    kind: v.literal("ready"),
    totals: sessionTotalsSchema,
    failed: countSchema,
  }),
]);

export const aiActivityRequestSchemas = {
  /** What the local AI is doing now, decided by the background from the queue. */
  "aiActivity.read": v.object({}),
} as const;

export const aiActivityResponseSchemas = {
  "aiActivity.state": activityStateSchema,
} as const;

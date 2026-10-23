import * as v from "valibot";

export const aiSetupRequestSchemas = {
  /** Where the user stands: answered from storage, never by asking Ollama. */
  "aiSetup.read": v.object({}),
  /** Opens the setup page, or selects it when it is open already. */
  "aiSetup.open": v.object({}),
  /** The user opened setup or acted toward it: from now on Ollama may be contacted. */
  "aiSetup.start": v.object({}),
  /** Folds the popup's setup banner to one line, or unfolds it. */
  "aiSetup.collapseBanner": v.object({ isCollapsed: v.boolean() }),
  /** Turns AI on: both recommended models, embedding first. Joins a run already under way. */
  "aiSetup.turnOn": v.object({}),
  /** Where "Turn on AI" stands, and follows it on this port while it runs. */
  "aiSetup.watch": v.object({}),
} as const;

export const aiSetupStatusSchema = v.object({
  /** An embedding model is active, so similar pages work. */
  isSetUp: v.boolean(),
  /** The user started setup, so the extension may contact Ollama. */
  isStarted: v.boolean(),
  isBannerCollapsed: v.boolean(),
});

const enableStageSchema = v.picklist(["downloading", "checking"]);

export const turnOnProgressSchema = v.object({
  /** The model being set up now. */
  name: v.string(),
  family: v.picklist(["embedding", "text-generation"]),
  stage: enableStageSchema,
  /** Of the whole run, from 0 to 1. */
  fraction: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  /** The embedding model is already on, so similar pages work. */
  isEmbeddingReady: v.boolean(),
});

export const aiSetupResponseSchemas = {
  "aiSetup.status": aiSetupStatusSchema,
  "aiSetup.opened": v.object({}),
  "aiSetup.turnOnProgress": turnOnProgressSchema,
  /** "Turn on AI" finished: every model it planned is on. */
  "aiSetup.turnedOn": aiSetupStatusSchema,
  "aiSetup.turnOnState": v.object({
    isRunning: v.boolean(),
    progress: v.optional(turnOnProgressSchema),
  }),
  "aiSetup.turnOnFailed": v.object({
    /** The model that failed; absent when Ollama could not be reached at all. */
    name: v.optional(v.string()),
    stage: enableStageSchema,
    reason: v.string(),
  }),
} as const;

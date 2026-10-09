import * as v from "valibot";

import { INFERENCE_DEVICES, MODEL_FAMILIES } from "@/shared/modelManifest";

/**
 * Messages about what is installed.
 *
 * Read-only: activation and installation are their own messages, so a surface
 * that only wants to render the current state cannot change it by accident.
 */
export const modelRegistryRequestSchemas = {
  "model.list": v.object({}),
  /**
   * Activate an installed model, which runs its conformance suite first.
   *
   * The device is named rather than chosen for us: the measurements this change
   * exists to produce depend on which compute path ran, so it has to be a
   * decision and not a default the runtime made.
   */
  "model.activate": v.object({
    ref: v.pipe(v.string(), v.minLength(1)),
    device: v.optional(v.picklist(INFERENCE_DEVICES)),
  }),
} as const;

/** One installed model, flattened to what a surface actually renders. */
export const installedModelSummarySchema = v.object({
  ref: v.string(),
  repository: v.string(),
  revision: v.string(),
  family: v.picklist(MODEL_FAMILIES),
  quantization: v.optional(v.string()),
  conformance: v.picklist(["pending", "passed", "failed"]),
  /** Why conformance failed, so a refusal can be explained rather than stated. */
  conformanceReason: v.optional(v.string()),
  diskBytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
  active: v.boolean(),
  installedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const modelRegistryResponseSchemas = {
  "model.listed": v.object({ models: v.array(installedModelSummarySchema) }),
  /**
   * The outcome of an activation attempt, whether or not it succeeded.
   *
   * Carries every probe rather than only the verdict, because "failed its
   * checks" is not actionable and "4 of 20 pairs ordered correctly" is.
   */
  "model.activated": v.object({
    ref: v.string(),
    active: v.boolean(),
    conformance: v.picklist(["pending", "passed", "failed"]),
    reason: v.optional(v.string()),
    device: v.picklist(INFERENCE_DEVICES),
    probes: v.array(v.object({ name: v.string(), passed: v.boolean(), detail: v.string() })),
  }),
  "model.activationFailed": v.object({ ref: v.string(), reason: v.string() }),
} as const;

export type InstalledModelSummary = v.InferOutput<typeof installedModelSummarySchema>;
export type ModelRegistryRequestType = keyof typeof modelRegistryRequestSchemas;
export type ModelRegistryResponseType = keyof typeof modelRegistryResponseSchemas;

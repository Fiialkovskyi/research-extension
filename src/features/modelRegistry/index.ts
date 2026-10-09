/**
 * What a model *is*: which ones ship, what they are pinned to, what they
 * declare about themselves, and which one a feature may use.
 *
 * Steps 2, 3 and 7 of the pipeline. It pins a reference to an immutable commit
 * (2), derives the manifest that makes the files verifiable (3), and — after
 * conformance has passed — decides which model is active (7). Feature code reaches
 * a model only through `getActiveModel`, by family, never by repository: that
 * is what lets a model be swapped without touching anything that uses it.
 *
 * Knows nothing about how a model runs. It describes and gates; `inference`
 * executes.
 */

// `ui/` is deliberately absent from this barrel: its components stay out of it so that
// the background, which imports feature barrels and has no use for React, never pulls React in.
// The surface that renders a component imports it from `ui/` by path.

export {
  installedModelSummarySchema,
  modelRegistryRequestSchemas,
  modelRegistryResponseSchemas,
} from "./schemas";
export type {
  InstalledModelSummary,
  ModelRegistryRequestType,
  ModelRegistryResponseType,
} from "./types";
export { activateModel } from "./model/activateModel";
export type { ActivateModelOptions } from "./model/activateModel";
export { buildModelManifest } from "./model/buildModelManifest";
export type { ModelManifestSources } from "./model/buildModelManifest";
export { getActiveModel } from "./model/getActiveModel";
export { listInstalledModels } from "./model/listInstalledModels";
export { resolveModelRevision } from "./model/resolveModelRevision";

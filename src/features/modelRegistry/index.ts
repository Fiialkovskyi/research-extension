/**
 * What a model *is*: which ones ship, what they are pinned to, what they
 * declare about themselves, and which one a feature may use.
 *
 * Third step of the pipeline and the last. It pins a reference to an immutable
 * commit, derives the manifest that makes the files verifiable, and — after
 * conformance has passed — decides which model is active. Feature code reaches
 * a model only through `getActiveModel`, by family, never by repository: that
 * is what lets a model be swapped without touching anything that uses it.
 *
 * Knows nothing about how a model runs. It describes and gates; `inference`
 * executes.
 */

export {
  installedModelSummarySchema,
  modelRegistryRequestSchemas,
  modelRegistryResponseSchemas,
} from "./constants";
export type {
  InstalledModelSummary,
  ModelRegistryRequestType,
  ModelRegistryResponseType,
} from "./constants";
export { activateModel } from "./model/activateModel";
export type { ActivateModelOptions } from "./model/activateModel";
export { buildModelManifest } from "./model/buildModelManifest";
export type { ModelManifestSources } from "./model/buildModelManifest";
export { getActiveModel } from "./model/getActiveModel";
export { listInstalledModels } from "./model/listInstalledModels";
export { resolveModelRevision } from "./model/resolveModelRevision";

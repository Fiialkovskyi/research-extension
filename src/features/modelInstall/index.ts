/**
 * Getting a model's files onto the machine, and refusing anything that does not
 * match what the manifest describes.
 *
 * Step 4 of the pipeline (files are fetched and verified). Nothing here starts on its own: an install
 * happens only in answer to an explicit message, files are fetched one at a
 * time with no credentials, each is checked against its digest *before* being
 * stored, and a single failure removes everything the attempt wrote.
 *
 * It records the model **inactive, with conformance pending**. Deciding that a
 * model may be used is `modelRegistry`'s job, and only after `modelConformance`
 * has had its say.
 */

// `ui/` is deliberately absent from this barrel: its components stay out of it so that
// the background, which imports feature barrels and has no use for React, never pulls React in.
// The surface that renders a component imports it from `ui/` by path.

export { modelInstallRequestSchemas, modelInstallResponseSchemas } from "./schemas";
export type { ModelInstallRequestType, ModelInstallResponseType } from "./types";
export { assertFileDigest } from "./model/assertFileDigest";
export { downloadModelFiles } from "./model/downloadModelFiles";
export type { InstallProgress } from "./model/downloadModelFiles";
export { installModel } from "./model/installModel";
export type { InstallModelOptions } from "./model/installModel";

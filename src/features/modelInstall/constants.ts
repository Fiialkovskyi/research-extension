import * as v from "valibot";

/**
 * Messages that drive an install.
 *
 * An install happens only in answer to one of these. Nothing downloads when the
 * background wakes, when a surface opens, or on any schedule — the user asks,
 * and only then does the add-on reach the network.
 */
export const modelInstallRequestSchemas = {
  /**
   * Install a bundled profile, named by its repository.
   *
   * A repository rather than an index so the message stays readable in logs and
   * survives the profile list being reordered. Arbitrary repositories are not
   * accepted yet: this change installs the profiles that ship with the add-on.
   */
  "model.install": v.object({
    repository: v.pipe(v.string(), v.minLength(1)),
  }),
} as const;

export const modelInstallResponseSchemas = {
  "model.installProgress": v.object({
    path: v.string(),
    completedFiles: v.pipe(v.number(), v.integer(), v.minValue(0)),
    totalFiles: v.pipe(v.number(), v.integer(), v.minValue(0)),
    completedBytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
    totalBytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  "model.installed": v.object({
    ref: v.string(),
    diskBytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
    conformance: v.picklist(["pending", "passed", "failed"]),
  }),
  "model.installFailed": v.object({
    repository: v.string(),
    reason: v.string(),
  }),
} as const;

export type ModelInstallRequestType = keyof typeof modelInstallRequestSchemas;
export type ModelInstallResponseType = keyof typeof modelInstallResponseSchemas;

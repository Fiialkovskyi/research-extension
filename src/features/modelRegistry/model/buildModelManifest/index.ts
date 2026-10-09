import * as v from "valibot";

import type { ModelProfile } from "@/shared/config";
import { type ModelManifest, modelManifestSchema } from "@/shared/modelManifest";
import { buildModelContract } from "./utils/buildModelContract";
import { parseModelTree } from "./utils/parseModelTree";
import { readModelLimits } from "./utils/readModelLimits";

/** Everything a manifest is derived from, at one pinned revision. */
export interface ModelManifestSources {
  profile: ModelProfile;
  /** The repository's own `config.json`. */
  config: unknown;
  /** The repository's own `tokenizer_config.json`. */
  tokenizerConfig: unknown;
  /** The hub's file listing for the pinned revision. */
  tree: unknown;
}

/**
 * Derives a model's manifest from the repository plus its bundled profile.
 *
 * The split is deliberate and follows what is actually knowable. Dimensionality
 * and token limits are published by the model, so they are read rather than
 * declared — a profile that got them wrong would be a silent source of
 * nonsense. Pooling, normalization, the similarity metric and role prefixes are
 * published nowhere machine-readable, so they come from the profile and are
 * checked afterwards by the conformance suite.
 *
 * Where several sources bound the input length, the smallest wins: a tokenizer
 * willing to encode more tokens than the model can attend to is not a licence
 * to send them.
 *
 * @throws when a listed file is absent from the revision, when the repository
 *   does not publish a value that cannot be declared, or when the result is not
 *   a valid manifest.
 */
export const buildModelManifest = (sources: ModelManifestSources): ModelManifest => {
  const { profile } = sources;
  const treeFiles = parseModelTree(sources.tree);
  const limits = readModelLimits(sources.config, sources.tokenizerConfig);

  const files = profile.files.map((path) => {
    const file = treeFiles.get(path);

    if (file === undefined) {
      throw new Error(
        `${profile.repository}@${profile.revision} does not carry a verifiable "${path}". ` +
          `Either the revision is wrong or the profile lists a file the repository renamed.`,
      );
    }

    return { path, digest: file.digest, bytes: file.bytes };
  });

  const contract = buildModelContract(profile, limits);

  const parsed = v.safeParse(modelManifestSchema, {
    manifestVersion: 1,
    reference: {
      hub: "huggingface",
      repository: profile.repository,
      revision: profile.revision,
    },
    format: "onnx",
    quantization: profile.quantization,
    files,
    license: profile.license,
    contract,
  });

  if (!parsed.success) {
    throw new Error(
      `Derived an invalid manifest for ${profile.repository}: ` +
        `${parsed.issues[0]?.message ?? "unknown issue"}`,
    );
  }

  return parsed.output;
};

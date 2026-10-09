import type * as v from "valibot";

import type { INFERENCE_DEVICES, MODEL_FAMILIES } from "./constants";
import type {
  embeddingContractSchema,
  fileDigestSchema,
  modelContractSchema,
  modelFileSchema,
  modelManifestSchema,
  modelReferenceSchema,
  textGenerationContractSchema,
} from "./schemas";

export type ModelFamily = (typeof MODEL_FAMILIES)[number];
export type InferenceDevice = (typeof INFERENCE_DEVICES)[number];
export type ModelReference = v.InferOutput<typeof modelReferenceSchema>;
export type EmbeddingContract = v.InferOutput<typeof embeddingContractSchema>;
export type TextGenerationContract = v.InferOutput<typeof textGenerationContractSchema>;
export type ModelContract = v.InferOutput<typeof modelContractSchema>;
export type FileDigest = v.InferOutput<typeof fileDigestSchema>;
export type ModelFile = v.InferOutput<typeof modelFileSchema>;
export type ModelManifest = v.InferOutput<typeof modelManifestSchema>;

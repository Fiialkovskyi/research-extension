/**
 * What a model is, as the add-on records it: its pinned reference, its files
 * with their digests, and the contract it declares.
 *
 * Shaped by the target spec's model abstraction rather than by any one
 * function, and read by the persistence layer, the registry, the installer and
 * the provider alike — which is why it lives here rather than beside one of
 * them.
 *
 * Validation schemas sit next to the types because a manifest crosses a trust
 * boundary twice: it is derived from files fetched over the network, and it is
 * read back out of storage.
 */

export {
  commitRevisionSchema,
  embeddingContractSchema,
  fileDigestSchema,
  INFERENCE_DEVICES,
  MODEL_FAMILIES,
  modelContractSchema,
  modelFileSchema,
  modelManifestSchema,
  modelReferenceSchema,
  textGenerationContractSchema,
} from "./constants";
export type {
  EmbeddingContract,
  FileDigest,
  InferenceDevice,
  ModelContract,
  ModelFamily,
  ModelFile,
  ModelManifest,
  ModelReference,
  TextGenerationContract,
} from "./constants";
export { getModelRef } from "./getModelRef";

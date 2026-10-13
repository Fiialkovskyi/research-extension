/**
 * Entity resolution (SYN step 6): the facts of a session grouped into one
 * entity per real thing, however each page names it — by normalised name,
 * then by the similarity of the names' embeddings within one type — with
 * every merge recorded so the user can undo it. Also reads fact values into
 * comparable units (`unitNormalizer@1`).
 *
 * Entity names are page content, so they are stored only encrypted.
 */

export {
  ENTITY_SIMILARITY_THRESHOLD,
  RESOLVE_ENTITIES_JOB,
  UNIT_NORMALIZER_VERSION,
} from "./constants";
export {
  entityResolutionRequestSchemas,
  entityResolutionResponseSchemas,
  resolveEntitiesPayloadSchema,
} from "./schemas";
export type { ResolveEntitiesPayload, SealedEntity } from "./types";
export { enqueueEntityResolutions } from "./model/enqueueEntityResolutions";
export { type EntityCandidate, type EntityMatch, matchEntity } from "./model/matchEntity";
export { type NormalizedValue, readNormalizedValue } from "./model/readNormalizedValue";
export { readSealedEntity } from "./model/readSealedEntity";
export {
  runEntityResolutionJob,
  type RunEntityResolutionJobOptions,
} from "./model/runEntityResolutionJob";
export { separateEntity } from "./model/separateEntity";

/**
 * Snapshot embeddings: deep-read page text cut into chunks (`chunker@1`),
 * embedded in the background into the active model's space, and stored as
 * vectors that say which space they belong to (REQ-LIN-001, REQ-LIN-002).
 *
 * Provider-agnostic: the model is loaded through whatever the caller passes,
 * so the native host can take over without this changing.
 */

export { CHUNKER_VERSION, EMBED_SNAPSHOT_JOB } from "./constants";
export { EmbeddingSpaceMismatchError } from "./errors";
export type { EmbedSnapshotPayload } from "./types";
export { buildEmbeddingSpace } from "./model/buildEmbeddingSpace";
export { chunkText } from "./model/chunkText";
export type { TextChunk } from "./model/chunkText";
export { compareVectors } from "./model/compareVectors";
export type { SpacedVector } from "./model/compareVectors";
export { enqueueSnapshotEmbeddings } from "./model/enqueueSnapshotEmbeddings";
export { runEmbeddingJob } from "./model/runEmbeddingJob";
export type { EmbeddingSession, RunEmbeddingJobOptions } from "./model/runEmbeddingJob";
export { readSpaceCoverage } from "./model/readSpaceCoverage";
export { splitChunkForModel } from "./model/splitChunkForModel";

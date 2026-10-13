import { CHUNKER_VERSION } from "@/features/snapshotEmbeddings";

import { FACT_EXTRACTION_PROMPT } from "../../constants";

/**
 * What produces a snapshot's facts: the prompt version, the generation model
 * and the chunker. Part of the extraction job's identity, so a page is
 * extracted once per prompt version and model, and again when either changes.
 */
export const getFactProducerVersion = (modelRef: string): string =>
  `${FACT_EXTRACTION_PROMPT.id}@${FACT_EXTRACTION_PROMPT.version}|${modelRef}|${CHUNKER_VERSION}`;

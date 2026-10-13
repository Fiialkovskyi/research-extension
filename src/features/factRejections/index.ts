/**
 * Fact rejections (REQ-LIN-008): the user marks a fact wrong once, and every
 * fact stating the same thing — however written, from any model, now or
 * later — is left out of the table, gaps and summaries until restored.
 * Rejections are stored by a hash of the normalised statement only.
 */

export { filterRejectedFacts } from "./model/filterRejectedFacts";
export { getFactKey, type StatedFact } from "./model/getFactKey";
export { readRejectedKeys } from "./model/readRejectedKeys";
export { rejectFacts } from "./model/rejectFacts";
export { restoreRejections } from "./model/restoreRejections";
export { factRejectionRequestSchemas, factRejectionResponseSchemas } from "./schemas";

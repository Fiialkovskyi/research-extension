import * as v from "valibot";

/** The raw protocol reference a chrome-context element lookup answers with. */
export const elementReferenceSchema = v.record(v.string(), v.string());

import type * as v from "valibot";

import type { DOMAIN_CATEGORIES, GAP_CATEGORIES } from "./constants";
import type { researchGapSchema, researchGapsSchema } from "./schemas";

export type DomainCategory = (typeof DOMAIN_CATEGORIES)[number];
export type GapCategory = (typeof GAP_CATEGORIES)[number];
export type ResearchGap = v.InferOutput<typeof researchGapSchema>;
export type ResearchGaps = v.InferOutput<typeof researchGapsSchema>;

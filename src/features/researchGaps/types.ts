import type * as v from "valibot";

import type { GAP_CATEGORIES } from "./constants";
import type { researchGapSchema, researchGapsSchema } from "./schemas";

/** A kind of source a page can be: shop, review, forum or video. */
export type GapCategory = (typeof GAP_CATEGORIES)[number];
export type ResearchGap = v.InferOutput<typeof researchGapSchema>;
export type ResearchGaps = v.InferOutput<typeof researchGapsSchema>;

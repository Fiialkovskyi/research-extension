import type * as v from "valibot";

import type { aiSetupStatusSchema, turnOnProgressSchema } from "./schemas";

/** Where the user stands with local AI, as every surface is told it. */
export type AiSetupStatus = v.InferOutput<typeof aiSetupStatusSchema>;

/** Where "Turn on AI" stands, pushed to every page following it. */
export type TurnOnProgress = v.InferOutput<typeof turnOnProgressSchema>;

import type * as v from "valibot";

import type { spaceUsageSchema } from "./schemas";

export type SpaceUsage = v.InferOutput<typeof spaceUsageSchema>;

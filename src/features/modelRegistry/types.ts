import type * as v from "valibot";

import type {
  installedModelSummarySchema,
  modelRegistryRequestSchemas,
  modelRegistryResponseSchemas,
} from "./schemas";

export type InstalledModelSummary = v.InferOutput<typeof installedModelSummarySchema>;
export type ModelRegistryRequestType = keyof typeof modelRegistryRequestSchemas;
export type ModelRegistryResponseType = keyof typeof modelRegistryResponseSchemas;

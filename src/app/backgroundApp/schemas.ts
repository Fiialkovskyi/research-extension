import { diagnosticsRequestSchemas } from "@/features/diagnostics";
import { inferenceRequestSchemas } from "@/features/inference";
import { benchmarkRequestSchemas } from "@/features/inferenceBenchmark";
import { modelInstallRequestSchemas } from "@/features/modelInstall";
import { modelRegistryRequestSchemas } from "@/features/modelRegistry";
import { researchSessionRequestSchemas } from "@/features/researchSession";
import { tabGroupRequestSchemas } from "@/features/tabGroups";

/** Every message a surface may send, contributed by the features that own them. */
export const requestSchemas = {
  ...benchmarkRequestSchemas,
  ...diagnosticsRequestSchemas,
  ...inferenceRequestSchemas,
  ...modelInstallRequestSchemas,
  ...modelRegistryRequestSchemas,
  ...researchSessionRequestSchemas,
  ...tabGroupRequestSchemas,
} as const;

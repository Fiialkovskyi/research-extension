import { clusterSummaryRequestSchemas } from "@/features/clusterSummaries";
import { comparisonTableRequestSchemas } from "@/features/comparisonTable";
import { diagnosticsRequestSchemas } from "@/features/diagnostics";
import { entityResolutionRequestSchemas } from "@/features/entityResolution";
import { factExtractionRequestSchemas } from "@/features/factExtraction";
import { inferenceRequestSchemas } from "@/features/inference";
import {
  benchmarkRequestSchemas,
  generationBenchmarkRequestSchemas,
} from "@/features/inferenceBenchmark";
import { modelInstallRequestSchemas } from "@/features/modelInstall";
import { modelRegistryRequestSchemas } from "@/features/modelRegistry";
import { ollamaRequestSchemas } from "@/features/ollama";
import { recordedDataRequestSchemas } from "@/features/recordedData";
import { researchLibraryRequestSchemas } from "@/features/researchLibrary";
import { researchMapRequestSchemas } from "@/features/researchMap";
import { researchSessionRequestSchemas } from "@/features/researchSession";
import { tabGroupRequestSchemas } from "@/features/tabGroups";

/** Every message a surface may send, contributed by the features that own them. */
export const requestSchemas = {
  ...benchmarkRequestSchemas,
  ...clusterSummaryRequestSchemas,
  ...comparisonTableRequestSchemas,
  ...diagnosticsRequestSchemas,
  ...entityResolutionRequestSchemas,
  ...factExtractionRequestSchemas,
  ...generationBenchmarkRequestSchemas,
  ...inferenceRequestSchemas,
  ...modelInstallRequestSchemas,
  ...modelRegistryRequestSchemas,
  ...ollamaRequestSchemas,
  ...recordedDataRequestSchemas,
  ...researchLibraryRequestSchemas,
  ...researchMapRequestSchemas,
  ...researchSessionRequestSchemas,
  ...tabGroupRequestSchemas,
} as const;

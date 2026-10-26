import { aiActivityRequestSchemas } from "@/features/aiActivity";
import { aiSetupRequestSchemas } from "@/features/aiSetup";
import { clusterSummaryRequestSchemas } from "@/features/clusterSummaries";
import { comparisonTableRequestSchemas } from "@/features/comparisonTable";
import { researchGapRequestSchemas } from "@/features/researchGaps";
import { factRejectionRequestSchemas } from "@/features/factRejections";
import { openQuestionRequestSchemas } from "@/features/openQuestions";
import { embeddingSpaceRequestSchemas } from "@/features/embeddingSpaces";
import { siteDenylistRequestSchemas } from "@/features/siteDenylist";
import { diagnosticsRequestSchemas } from "@/features/diagnostics";
import { entityResolutionRequestSchemas } from "@/features/entityResolution";
import { factExtractionRequestSchemas } from "@/features/factExtraction";
import { inferenceRequestSchemas } from "@/features/inference";
import { liveDataRequestSchemas } from "@/features/liveData";
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
  ...aiActivityRequestSchemas,
  ...aiSetupRequestSchemas,
  ...benchmarkRequestSchemas,
  ...clusterSummaryRequestSchemas,
  ...comparisonTableRequestSchemas,
  ...researchGapRequestSchemas,
  ...factRejectionRequestSchemas,
  ...openQuestionRequestSchemas,
  ...embeddingSpaceRequestSchemas,
  ...siteDenylistRequestSchemas,
  ...diagnosticsRequestSchemas,
  ...entityResolutionRequestSchemas,
  ...factExtractionRequestSchemas,
  ...generationBenchmarkRequestSchemas,
  ...inferenceRequestSchemas,
  ...liveDataRequestSchemas,
  ...modelInstallRequestSchemas,
  ...modelRegistryRequestSchemas,
  ...ollamaRequestSchemas,
  ...recordedDataRequestSchemas,
  ...researchLibraryRequestSchemas,
  ...researchMapRequestSchemas,
  ...researchSessionRequestSchemas,
  ...tabGroupRequestSchemas,
} as const;

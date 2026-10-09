import type { modelInstallRequestSchemas, modelInstallResponseSchemas } from "./schemas";

export type ModelInstallRequestType = keyof typeof modelInstallRequestSchemas;
export type ModelInstallResponseType = keyof typeof modelInstallResponseSchemas;

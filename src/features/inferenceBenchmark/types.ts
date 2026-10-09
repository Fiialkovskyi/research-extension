import type { benchmarkRequestSchemas, benchmarkResponseSchemas } from "./schemas";

export type BenchmarkRequestType = keyof typeof benchmarkRequestSchemas;
export type BenchmarkResponseType = keyof typeof benchmarkResponseSchemas;

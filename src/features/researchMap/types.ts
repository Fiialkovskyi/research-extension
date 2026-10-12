import type * as v from "valibot";

import type {
  graphSnapshotSchema,
  mapClusterSchema,
  mapEdgeSchema,
  mapNodeSchema,
  researchMapRequestSchemas,
  researchMapResponseSchemas,
} from "./schemas";

export type GraphSnapshot = v.InferOutput<typeof graphSnapshotSchema>;
export type MapNode = v.InferOutput<typeof mapNodeSchema>;
export type MapEdge = v.InferOutput<typeof mapEdgeSchema>;
export type MapCluster = v.InferOutput<typeof mapClusterSchema>;
export type ResearchMapRequestType = keyof typeof researchMapRequestSchemas;
export type ResearchMapResponseType = keyof typeof researchMapResponseSchemas;

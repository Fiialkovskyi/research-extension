import { buildHubUrl } from "@/shared/huggingFace";

/**
 * Builds the hub URL that reports which commit a reference currently points at.
 *
 * Segment escaping and the refusal of relative components are
 * {@link buildHubUrl}'s job; this function's only concern is the shape of the
 * revision endpoint.
 */
export const getModelRevisionUrl = (repository: string, reference: string): string => {
  return buildHubUrl("/api/models/", [
    ...repository.split("/"),
    "revision",
    ...reference.split("/"),
  ]);
};

import { buildHubUrl } from "@/shared/huggingFace";

/**
 * Builds the URL of a revision's full file listing.
 *
 * Recursive, because the weights live under a subdirectory and a shallow
 * listing would report that directory rather than the files inside it.
 */
export const getModelTreeUrl = (repository: string, revision: string): string => {
  return `${buildHubUrl("/api/models/", [...repository.split("/"), "tree", revision])}?recursive=1`;
};

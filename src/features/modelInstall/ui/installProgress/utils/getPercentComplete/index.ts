import type { InstallProgress } from "../../../../model/downloadModelFiles";

/** Share of the download completed, as a whole percentage. */
export const getPercentComplete = (progress: InstallProgress): number => {
  if (progress.totalBytes === 0) {
    return 0;
  }

  return Math.round((progress.completedBytes / progress.totalBytes) * 100);
};

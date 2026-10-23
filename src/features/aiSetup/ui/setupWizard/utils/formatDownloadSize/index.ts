/** A download's size as people say it: `2.8 GB`, `274 MB`. */
export const formatDownloadSize = (bytes: number): string =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;

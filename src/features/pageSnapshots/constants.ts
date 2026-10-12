/**
 * The most text a snapshot keeps, in UTF-8 bytes (REQ-CAP-006). A longer page
 * is cut here and its snapshot marked truncated.
 */
export const MAXIMUM_SNAPSHOT_BYTES = 200 * 1024;

/**
 * Which extractor produced a snapshot's text: the library and its version, and
 * the version of the cleaning applied after it. Raised whenever either changes,
 * so text from different extractors is never mistaken for the same.
 */
export const EXTRACTOR_VERSION = "readability@0.6.0/1";

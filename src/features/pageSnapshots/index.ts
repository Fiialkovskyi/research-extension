/**
 * Page snapshots: the readable text of a page the user read closely, captured
 * once and stored against its node for later indexing and synthesis.
 *
 * The text is extracted in the page and stored by the background, compressed
 * and encrypted with the data key (REQ-SEC-005).
 */

// `model/extractReadableText` is deliberately absent from this barrel. It runs
// in the page and imports Readability; the background imports this barrel and
// must not bundle it. The page observer's entrypoint imports it by path.

export { EXTRACTOR_VERSION, MAXIMUM_SNAPSHOT_BYTES } from "./constants";
export { readSnapshotCandidate } from "./model/readSnapshotCandidate";
export { readSnapshotText } from "./model/readSnapshotText";
export { recordSnapshot } from "./model/recordSnapshot";
export type { ExtractedText } from "./model/recordSnapshot";
export { sealPlaintextSnapshots } from "./model/sealPlaintextSnapshots";
export { truncateUtf8Text } from "./model/truncateUtf8Text";
export type { TruncatedText } from "./model/truncateUtf8Text";

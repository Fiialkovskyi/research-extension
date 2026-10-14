import { DOCUMENT_LOAD_TYPE } from "../../constants";
import type { EgressRequest } from "../parseEgressLog";

/**
 * The requests that count as the add-on reaching out (REQ-SEC-001): every one
 * it triggered except a top-level page load, which is a tab it opened at the
 * user's request — a gap's search, a resumed session — and is the user's
 * browsing, not the add-on's.
 */
export const findExtensionEgress = (requests: readonly EgressRequest[]): EgressRequest[] =>
  requests.filter(({ type }) => type !== DOCUMENT_LOAD_TYPE);

/**
 * Addressing the hub: the origins the package permits itself to reach, and how
 * a repository, a revision and a path become a URL.
 *
 * One source of truth on purpose. The manifest's `connect-src`, the code that
 * builds download URLs, and the cache that recognises them all read from here,
 * so the policy cannot drift from the requests it is meant to permit.
 *
 * Path building refuses empty and relative segments. Percent-encoding alone is
 * not enough: a dot is an unreserved character, so `..` survives escaping and
 * the URL parser then resolves it away, turning a file request into a request
 * for an entirely different endpoint.
 */

export { buildHubUrl } from "./buildHubUrl";
export { HUGGING_FACE_ORIGIN, HUGGING_FACE_RESOLVE_SEGMENT, MODEL_HOST_ORIGINS } from "./constants";
export { getHuggingFaceFileUrl } from "./getHuggingFaceFileUrl";
export { type HubFileRequest, parseHubFileUrl } from "./parseHubFileUrl";

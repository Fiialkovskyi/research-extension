/** The chrome topic every HTTP request passes before it is sent. */
export const EGRESS_OBSERVER_TOPIC = "http-on-modify-request";

/** `nsIContentPolicy.TYPE_DOCUMENT`: a top-level page load, such as a tab the extension opened. */
export const DOCUMENT_LOAD_TYPE = 6;

/** Where the recorder keeps its log: a property of the hidden window, which lives as long as the app. */
export const EGRESS_LOG_PROPERTY = "__researchGraphEgress";

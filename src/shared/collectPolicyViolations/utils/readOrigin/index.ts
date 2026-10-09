/**
 * Origin of a blocked URI, or the raw value when an origin would say nothing.
 *
 * Only the origin is kept from an ordinary URL. A single install makes many
 * requests to the same host, and a list of two hundred paths hides the one fact
 * that matters: which host the policy would not allow.
 *
 * Two kinds of refusal are reported without a usable origin, and both are kept
 * verbatim instead:
 *
 * - **Not a URL at all.** Some arrive as the literal `inline` or `eval`, which
 *   fail to parse. For diagnosis, knowing that *something* unparseable was
 *   refused beats silence.
 * - **An opaque origin.** `blob:` and `data:` parse, but their origin is the
 *   string `null`, which names nothing. The raw value is far more useful: a
 *   refused `blob:moz-extension://…` import says the blob came from this
 *   add-on's own code — which is exactly the shape of a real refusal hit while
 *   building this, where an `null` in the log would have pointed nowhere.
 */
export const readOrigin = (blockedURI: string): string => {
  try {
    const { origin } = new URL(blockedURI);

    return origin === "null" ? blockedURI : origin;
  } catch {
    return blockedURI;
  }
};

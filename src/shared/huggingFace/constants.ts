/**
 * Hugging Face as the add-on's only outbound destination.
 *
 * Kept for the in-extension backend, which is switched off for now
 * (`IS_IN_BROWSER_BACKEND_ENABLED`): while it is, the manifest names none of
 * these origins, so a request to one is blocked rather than merely unused.
 *
 * Single source of truth: the manifest's `connect-src` (`wxt.config.ts`) and
 * the code that builds file URLs both read these values, so the policy cannot
 * drift from the requests it is meant to permit. If a request is made to an
 * origin absent from {@link MODEL_HOST_ORIGINS}, the browser blocks it — which
 * is the enforcement point for the no-egress guarantee, not a safety net.
 */

/** Hub origin: repository metadata, revision resolution and download redirects. */
export const HUGGING_FACE_ORIGIN = "https://huggingface.co";

/** Path segment that pins a file request to one revision: `/<repo>/resolve/<sha>/<path>`. */
export const HUGGING_FACE_RESOLVE_SEGMENT = "resolve";

/**
 * Origins the package permits itself to connect to.
 *
 * File contents are not served from the hub: a download redirects to a storage
 * or CDN host under `hf.co`, and those names nest arbitrarily deep
 * (`us-east1.us.gcp.cdn.hf.co`). A CSP host wildcard matches subdomains at any
 * depth, so one entry covers them — unlike an enterprise proxy's single-label
 * wildcard, which is where Hugging Face's own warning about `*.hf.co` applies.
 * That difference is a hypothesis verified against a real download by the
 * model-install e2e spec, not assumed.
 *
 * `hf.co` is the hub's own short form and is not covered by `*.hf.co`; we do
 * not request it, so it is deliberately absent.
 */
export const MODEL_HOST_ORIGINS = [HUGGING_FACE_ORIGIN, "https://*.hf.co"] as const;

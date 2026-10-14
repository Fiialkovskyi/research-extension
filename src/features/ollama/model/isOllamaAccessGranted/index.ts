import { LOCAL_INFERENCE_ORIGINS } from "@/shared/config";

/**
 * Whether the user connected the local inference server (REQ-SEC-001a): its
 * own origin is among the granted host permissions, which only the options
 * page's "Connect" asks for.
 *
 * Not `permissions.contains`: page access (`<all_urls>`) covers loopback too,
 * so asking whether the origin is covered would treat allowing page access as
 * connecting Ollama, and the extension would reach a local server the user
 * never connected.
 *
 * @param grantedOrigins The granted origin patterns, as `permissions.getAll` lists them.
 */
export const isOllamaAccessGranted = (grantedOrigins: readonly string[]): boolean =>
  LOCAL_INFERENCE_ORIGINS.every((origin) => grantedOrigins.includes(`${origin}/*`));

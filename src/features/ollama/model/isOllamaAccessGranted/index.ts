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
 * A match pattern carries no port, and Firefox lists `http://127.0.0.1:11434/*`
 * back as `http://127.0.0.1/*`, so the origin is compared without its port.
 *
 * Kept for a loopback permission that is optional. While the manifest
 * requires it, as it does for now, the grant is always there and says nothing
 * about the user; whether they asked for AI is the stored "setup started"
 * choice instead.
 *
 * @param grantedOrigins The granted origin patterns, as `permissions.getAll` lists them.
 */
export const isOllamaAccessGranted = (grantedOrigins: readonly string[]): boolean =>
  LOCAL_INFERENCE_ORIGINS.every((origin) => {
    const { protocol, hostname } = new URL(origin);

    return grantedOrigins.some((granted) =>
      [`${protocol}//${hostname}/*`, `${origin}/*`].includes(granted),
    );
  });

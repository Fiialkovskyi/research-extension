import { parseHubFileUrl } from "@/shared/huggingFace";
import type { ModelReference } from "@/shared/modelManifest";

/** One verified file, as the background hands it to the worker. */
export interface ModelFileContents {
  path: string;
  contents: ArrayBuffer;
}

/**
 * The slice of the Web Cache API the model library asks for.
 *
 * It wants `match` and `put`; anything more is unused.
 */
export interface ModelFileCache {
  match: (request: string) => Promise<Response | undefined>;
  put: (request: string) => Promise<void>;
  /**
   * Keys the runtime asked for and this cache did not hold.
   *
   * Recorded because the runtime's own failure for a miss names only where it
   * looked *last* — a local path that was never going to exist — which says
   * nothing about the key it actually wanted. Comparing the two is the whole
   * diagnosis, so the comparison is kept rather than reconstructed.
   */
  readonly misses: readonly string[];
  /** Paths this cache holds, for the same comparison. */
  readonly keys: readonly string[];
}

/** Content types the library's parsers care about; everything else is bytes. */
const getContentType = (path: string): string => {
  return path.endsWith(".json") ? "application/json" : "application/octet-stream";
};

/**
 * Presents already-verified model files to the model library as a cache.
 *
 * This is the whole integration point. The library resolves each file it needs
 * to a hub URL and consults its cache first, so a cache that recognises those
 * URLs hands it our files and it never reaches the network. Paired with remote
 * loading switched off, that means **every byte the runtime sees has been
 * checked against the manifest** — the property the install pipeline exists to
 * establish, and one a plain `fetch` inside the library would quietly discard.
 *
 * Matching ignores the revision segment, which is not a shortcut. The runtime
 * asks for `resolve/main/…` even when it is handed a pinned commit, so a cache
 * keyed on the commit never matches anything. Ignoring the segment is sound
 * because this cache is built for one model at one revision whose files were
 * already verified: there is no other revision it could serve by mistake. The
 * repository is still checked, so one model's cache cannot answer for another's.
 *
 * That the runtime asks for a branch is worth knowing for its own sake: pinning
 * is enforced by us supplying the files, not by the library honouring the
 * revision it was given.
 *
 * Writes are refused. Anything the library wanted to store would be bytes that
 * never passed digest verification, and putting those beside verified files
 * would make the store's guarantee meaningless.
 */
export const createModelFileCache = (
  reference: ModelReference,
  files: readonly ModelFileContents[],
): ModelFileCache => {
  const byPath = new Map(files.map((file) => [file.path, file] as const));
  const misses: string[] = [];

  return {
    misses,
    keys: [...byPath.keys()],
    match: (request) => {
      const parsed = parseHubFileUrl(request);
      const file =
        parsed === undefined || parsed.repository !== reference.repository
          ? undefined
          : byPath.get(parsed.path);

      if (file === undefined) {
        // The library probes a local-path key before the URL one, so a single
        // miss is ordinary. Recorded anyway: which keys were tried is the only
        // way to tell an ordinary probe from a key that should have matched.
        misses.push(request);

        return Promise.resolve(undefined);
      }

      return Promise.resolve(
        new Response(file.contents, { headers: { "content-type": getContentType(file.path) } }),
      );
    },
    put: () => Promise.resolve(),
  };
};

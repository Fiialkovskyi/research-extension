import { HUGGING_FACE_ORIGIN, HUGGING_FACE_RESOLVE_SEGMENT } from "../constants";

/** The parts of a hub file URL that identify what was asked for. */
export interface HubFileRequest {
  repository: string;
  /** The revision segment as requested, which is not necessarily a commit. */
  revision: string;
  /** Path inside the repository, with its separators intact. */
  path: string;
}

/**
 * Takes apart a hub file URL.
 *
 * Returns nothing for anything that is not one — a local path, another origin,
 * a URL of a different shape — because a caller matching requests needs to tell
 * "not for me" apart from "for me but unknown".
 *
 * Segments are decoded, since a URL may arrive escaped or not depending on who
 * built it, and the two forms name the same file.
 */
export const parseHubFileUrl = (request: string): HubFileRequest | undefined => {
  let url;

  try {
    url = new URL(request);
  } catch {
    return undefined;
  }

  if (url.origin !== HUGGING_FACE_ORIGIN) {
    return undefined;
  }

  // The pathname starts with "/", so the first split element is always empty.
  // Any other empty segment makes the URL non-canonical, which this refuses
  // because the builder refuses it too.
  const segments = url.pathname.split("/").slice(1);

  // owner / name / resolve / revision / …path
  if (
    segments.length < 5 ||
    segments[2] !== HUGGING_FACE_RESOLVE_SEGMENT ||
    segments.some((segment) => segment === "")
  ) {
    return undefined;
  }

  let decoded;

  try {
    decoded = segments.map((segment) => decodeURIComponent(segment));
  } catch {
    // A malformed escape is not a file we could have requested.
    return undefined;
  }

  const [owner, name, , revision, ...path] = decoded;

  return {
    repository: `${owner}/${name}`,
    revision: revision ?? "",
    path: path.join("/"),
  };
};

import { extname, join, normalize, sep } from "node:path";

/** Content types of the files the suite serves; anything else is not served. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
};

/**
 * Maps a request path to a served file and its content type, or `undefined`
 * when the path leaves the pages directory or names a type not served.
 */
export const resolvePagePath = (
  root: string,
  requestPath: string,
): { path: string; contentType: string } | undefined => {
  const pathname = decodeURIComponent(requestPath.split("?")[0] ?? "");
  const path = normalize(join(root, pathname));
  const contentType = CONTENT_TYPES[extname(path)];

  if (
    !path.startsWith(normalize(root.endsWith(sep) ? root : root + sep)) ||
    contentType === undefined
  ) {
    return undefined;
  }

  return { path, contentType };
};

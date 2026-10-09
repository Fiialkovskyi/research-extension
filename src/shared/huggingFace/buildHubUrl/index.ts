import { HUGGING_FACE_ORIGIN } from "../constants";

/**
 * Joins path segments into a hub URL, escaping each one.
 *
 * Segments are escaped individually because hub paths are multi-part and the
 * separators are meaningful: a repository is `owner/name`, and a reference can
 * be `refs/pr/1`. Escaping the whole path at once would destroy those
 * separators; leaving it unescaped would let a crafted name address a different
 * endpoint.
 *
 * Escaping is not sufficient on its own. A dot is an unreserved character, so
 * `.` and `..` survive percent-encoding untouched and the URL parser then
 * resolves them away — `…/revision/../../../etc` collapses to `/api/models/etc`,
 * which is a different endpoint entirely. Neither is a valid component of a
 * repository name, a reference or a file path, so both are refused, along with
 * empty segments.
 *
 * @throws when any segment is empty or relative.
 */
export const buildHubUrl = (path: string, segments: readonly string[]): string => {
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") {
      throw new Error(
        `Invalid path segment "${segment}" in [${segments.join(", ")}]: ` +
          `hub paths carry no empty or relative components.`,
      );
    }
  }

  const escaped = segments.map((segment) => encodeURIComponent(segment)).join("/");

  return `${HUGGING_FACE_ORIGIN}${path}${escaped}`;
};

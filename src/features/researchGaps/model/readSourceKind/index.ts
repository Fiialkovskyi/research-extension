import { SOURCE_KIND_SIGNALS } from "../../constants";
import type { GapCategory } from "../../types";

/**
 * Reads what kind of source a page is — shop, review, forum or video — from
 * what the page declares about itself: the schema.org types of its JSON-LD and
 * its `og:type` (`SOURCE_KIND_SIGNALS`). Never from its host.
 *
 * @returns The kind, or `undefined` when the page declares nothing that says.
 */
export const readSourceKind = ({
  schemaTypes,
  type,
}: {
  schemaTypes?: readonly string[] | undefined;
  type?: string | undefined;
}): GapCategory | undefined => {
  const declared = new Set((schemaTypes ?? []).map((name) => name.toLowerCase()));
  const ogType = (type ?? "").toLowerCase();

  return (
    Object.entries(SOURCE_KIND_SIGNALS) as [
      GapCategory,
      { schemaTypes: readonly string[]; ogTypes: readonly string[] },
    ][]
  ).find(
    ([, signals]) =>
      signals.schemaTypes.some((name) => declared.has(name.toLowerCase())) ||
      signals.ogTypes.some((prefix) => ogType === prefix || ogType.startsWith(`${prefix}.`)),
  )?.[0];
};

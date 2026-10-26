import { rankConcepts } from "@/shared/rankConcepts";

import type { SummaryFact } from "../../types";

/**
 * Where each key spec of some facts stands: `0` for the most comparable
 * concept, then `1`, and so on (`rankConcepts`). A concept that is not a spec —
 * prose, the same on every entity, or one only one of several entities states —
 * has no place. The entities are the facts' groups and the pages their nodes,
 * so what several products share comes first, in any language.
 */
export const readKeySpecPlaces = (
  facts: readonly SummaryFact[],
  { isSharedOnly }: { isSharedOnly: boolean },
): Map<string, number> =>
  new Map(
    rankConcepts(
      facts.map(({ attributeKey, groupKey, nodeId, value, unit }) => ({
        key: attributeKey,
        entityId: groupKey,
        pageId: nodeId,
        value: unit === undefined ? value : `${value} ${unit}`,
      })),
    )
      .filter(({ isInformative, isSpec }) => (isSharedOnly ? isSpec : isInformative))
      .map(({ key }, place) => [key, place]),
  );

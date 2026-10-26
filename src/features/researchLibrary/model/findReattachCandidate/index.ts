import type { IDBPDatabase } from "idb";

import { readSessionRoot } from "@/features/researchGraph";
import { compareVectors } from "@/features/snapshotEmbeddings";
import { type ResearchDatabaseSchema, SESSION_STORE } from "@/shared/storage";

import { REATTACH_SIMILARITY, REATTACH_TERM_OVERLAP } from "../../constants";
import { readQueryTerms } from "./utils/readQueryTerms";

/** A saved session the new one looks like a continuation of, and why. */
export interface ReattachCandidate {
  sessionId: string;
  title: string;
  reason: "terms" | "meaning";
  score: number;
}

export interface FindReattachCandidateOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  sessionId: string;
  /** Embeds queries with the active model, all in one call; absent without a model. */
  embedQueries?: (queries: readonly string[]) => Promise<Float32Array[]>;
}

/** Shared terms over all terms. */
const readOverlap = (first: Set<string>, second: Set<string>): number => {
  const union = new Set([...first, ...second]);
  const shared = [...first].filter((term) => second.has(term)).length;

  return union.size === 0 ? 0 : shared / union.size;
};

/** One space for every vector of a single embedding call: they come from one model. */
const QUERY_SPACE = "reattach-queries";

/**
 * Finds the saved session the given session continues (REQ-STO-006), by its
 * first search: one whose first search shares enough terms with it, or — with
 * a model — means nearly the same. Meaning wins over terms when both match;
 * otherwise the higher score.
 *
 * @returns The best match, or `undefined` without a first search or a match.
 */
export const findReattachCandidate = async ({
  database,
  sessionId,
  embedQueries,
}: FindReattachCandidateOptions): Promise<ReattachCandidate | undefined> => {
  const root = await readSessionRoot(database, sessionId);

  if (root?.query === undefined) {
    return undefined;
  }

  // A closed session, its group gone, is saved as the user went and can be continued too.
  const saved = [
    ...(await database.getAllFromIndex(SESSION_STORE, "status", "saved")),
    ...(await database.getAllFromIndex(SESSION_STORE, "status", "closed")),
  ];
  const roots = (
    await Promise.all(
      saved.map(async (session) => ({
        session,
        root: await readSessionRoot(database, session.id),
      })),
    )
  ).flatMap(({ session, root: savedRoot }) =>
    savedRoot?.query === undefined ? [] : [{ session, query: savedRoot.query }],
  );

  if (roots.length === 0) {
    return undefined;
  }

  const terms = readQueryTerms(root.query);
  const vectors =
    embedQueries === undefined
      ? undefined
      : await embedQueries([root.query, ...roots.map(({ query }) => query)]);
  const [own] = vectors ?? [];
  const candidates = roots.flatMap(({ session, query }, index): ReattachCandidate[] => {
    const other = vectors?.[index + 1];

    if (own !== undefined && other !== undefined) {
      const similarity = compareVectors(
        { spaceId: QUERY_SPACE, vector: own },
        { spaceId: QUERY_SPACE, vector: other },
      );

      if (similarity >= REATTACH_SIMILARITY) {
        return [
          { sessionId: session.id, title: session.title, reason: "meaning", score: similarity },
        ];
      }
    }

    const overlap = readOverlap(terms, readQueryTerms(query));

    return overlap >= REATTACH_TERM_OVERLAP
      ? [{ sessionId: session.id, title: session.title, reason: "terms", score: overlap }]
      : [];
  });

  return candidates.toSorted(
    (first, second) =>
      Number(second.reason === "meaning") - Number(first.reason === "meaning") ||
      second.score - first.score ||
      first.sessionId.localeCompare(second.sessionId),
  )[0];
};

import { readdirSync, statSync } from "node:fs";

import type { Fixture, SkippedFixture } from "../../types";
import { readFixture } from "./utils/readFixture";

/**
 * Reads every fixture under a directory, by id in alphabetical order, so a run
 * is the same on every machine. A directory that does not exist holds none.
 */
export const readFixtures = (root: string): { fixtures: Fixture[]; skipped: SkippedFixture[] } => {
  let ids: string[];

  try {
    ids = readdirSync(root)
      .filter((name) => statSync(`${root}/${name}`).isDirectory())
      .toSorted();
  } catch {
    ids = [];
  }

  const read = ids.map((id) => readFixture(`${root}/${id}`, id));

  return {
    fixtures: read.filter((entry): entry is Fixture => "html" in entry),
    skipped: read.filter((entry): entry is SkippedFixture => "reason" in entry),
  };
};

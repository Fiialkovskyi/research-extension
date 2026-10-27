import { existsSync, readFileSync } from "node:fs";

import * as v from "valibot";

import { fixtureMetaSchema, labelsSchema } from "../../../../schemas";
import type { Fixture, SkippedFixture } from "../../../../types";

/** Reads a file and parses it as JSON, or says why it cannot. */
const readJson = (path: string): { ok: true; value: unknown } | { ok: false; reason: string } => {
  if (!existsSync(path)) {
    return { ok: false, reason: `${path} is missing` };
  }

  try {
    return { ok: true, value: JSON.parse(readFileSync(path, "utf8")) as unknown };
  } catch {
    return { ok: false, reason: `${path} is not JSON` };
  }
};

/**
 * Reads one fixture's directory. A fixture is skipped, never half-used, when its
 * page is not on this machine (a fixture kept out of git has only its labels), its
 * source or labels cannot be read, or its labels name no fact.
 */
export const readFixture = (directory: string, id: string): Fixture | SkippedFixture => {
  const htmlPath = `${directory}/page.html`;
  const meta = readJson(`${directory}/meta.json`);
  const labels = readJson(`${directory}/labels.json`);

  if (!meta.ok) {
    return { id, reason: meta.reason };
  }

  if (!labels.ok) {
    return { id, reason: labels.reason };
  }

  const parsedMeta = v.safeParse(fixtureMetaSchema, meta.value);
  const parsedLabels = v.safeParse(labelsSchema, labels.value);

  if (!parsedMeta.success || !parsedLabels.success) {
    return { id, reason: "its meta or labels do not match the schema" };
  }

  if (parsedLabels.output.facts.length === 0) {
    return { id, reason: "it has no labels yet" };
  }

  if (!existsSync(htmlPath)) {
    return { id, reason: "its page is not on this machine" };
  }

  return {
    id,
    html: readFileSync(htmlPath, "utf8"),
    meta: parsedMeta.output,
    labels: parsedLabels.output,
  };
};

import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { CAPTURE_TIMEOUT_MS, CAPTURE_USER_AGENT } from "../../constants";
import type { Labels } from "../../types";

/** The labels file of a new fixture: empty, so it is skipped until someone fills it in. */
const LABELS_TEMPLATE: Labels = { facts: [], sameConcept: [], differentConcept: [], products: [] };

/**
 * Saves a page as a new fixture: its HTML as the server sent it, where it came
 * from and the day, and an empty labels file to fill in. This runs on the
 * developer's machine as a development tool; the extension never fetches a page.
 *
 * @returns Where the fixture is, or why nothing was saved.
 */
export const captureFixture = async (
  url: string,
  id: string,
  root: string,
  today: string,
  fetchResource: typeof fetch = fetch,
): Promise<{ saved: true; directory: string } | { saved: false; reason: string }> => {
  const directory = `${root}/${id}`;

  if (existsSync(directory)) {
    return { saved: false, reason: `a fixture named ${id} already exists` };
  }

  const response = await fetchResource(url, {
    headers: { "User-Agent": CAPTURE_USER_AGENT },
    signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
  });

  if (!response.ok) {
    return { saved: false, reason: `${url} answered HTTP ${response.status}` };
  }

  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/page.html`, await response.text());
  writeFileSync(
    `${directory}/meta.json`,
    `${JSON.stringify({ url, savedOn: today }, undefined, 2)}\n`,
  );
  writeFileSync(`${directory}/labels.json`, `${JSON.stringify(LABELS_TEMPLATE, undefined, 2)}\n`);

  return { saved: true, directory };
};

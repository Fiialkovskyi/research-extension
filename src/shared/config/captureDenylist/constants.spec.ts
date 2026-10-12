import { describe, expect, it } from "vitest";

import { CAPTURE_DENYLIST } from "./constants";

/**
 * Guards what no type can: the list covers every category REQ-SEC-007 names,
 * and its entries are in the one form the matcher reads. An entry with a
 * scheme, a path or a capital would silently match nothing.
 */
const ENTRY = /^[a-z0-9-]+(\.[a-z0-9-]+)*(\.\*)?$/;

const entries = CAPTURE_DENYLIST.categories.flatMap(({ domains, suffixes, words }) => [
  ...domains,
  ...suffixes,
  ...words,
]);

describe("CAPTURE_DENYLIST", () => {
  it("names its version", () => {
    expect(CAPTURE_DENYLIST.version).toMatch(/^capture_denylist@\d+$/);
  });

  it("covers every category the spec requires, each with entries", () => {
    expect(CAPTURE_DENYLIST.categories.map(({ name }) => name).toSorted()).toEqual(
      ["banking", "government", "health", "passwordManagers", "webmail"].toSorted(),
    );

    for (const { name, domains, suffixes, words } of CAPTURE_DENYLIST.categories) {
      expect(domains.length + suffixes.length + words.length, name).toBeGreaterThan(0);
    }
  });

  it("holds every entry as a bare lowercase host part", () => {
    expect(entries.filter((entry) => !ENTRY.test(entry))).toEqual([]);
  });

  it("lists no entry twice", () => {
    expect(entries.filter((entry, index) => entries.indexOf(entry) !== index)).toEqual([]);
  });
});

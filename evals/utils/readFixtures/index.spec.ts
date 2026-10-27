import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readFixtures } from ".";

const labels = {
  facts: [{ concept: "weight", value: "184 g" }],
  sameConcept: [],
  differentConcept: [],
  products: ["Pixel 10a"],
};
const meta = { url: "https://example.com/p", savedOn: "2026-10-26" };
let root = "";

const write = (id: string, files: Record<string, string>): void => {
  mkdirSync(`${root}/${id}`);

  for (const [name, content] of Object.entries(files)) {
    writeFileSync(`${root}/${id}/${name}`, content);
  }
};

beforeEach(() => {
  root = mkdtempSync(`${tmpdir()}/evalFixtures`);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("readFixtures", () => {
  it("reads a complete fixture with its page, source and labels", () => {
    write("b", {
      "page.html": "<p>hi</p>",
      "meta.json": JSON.stringify(meta),
      "labels.json": JSON.stringify(labels),
    });

    const { fixtures, skipped } = readFixtures(root);

    expect(fixtures).toEqual([{ id: "b", html: "<p>hi</p>", meta, labels }]);
    expect(skipped).toEqual([]);
  });

  it("skips a fixture whose labels name no fact, and says why", () => {
    write("a", {
      "page.html": "<p>hi</p>",
      "meta.json": JSON.stringify(meta),
      "labels.json": JSON.stringify({ ...labels, facts: [] }),
    });

    expect(readFixtures(root)).toEqual({
      fixtures: [],
      skipped: [{ id: "a", reason: "it has no labels yet" }],
    });
  });

  it("skips a fixture kept without its page", () => {
    write("a", { "meta.json": JSON.stringify(meta), "labels.json": JSON.stringify(labels) });

    expect(readFixtures(root).skipped).toEqual([
      { id: "a", reason: "its page is not on this machine" },
    ]);
  });

  it("skips a fixture whose labels do not match the schema", () => {
    write("a", {
      "page.html": "x",
      "meta.json": JSON.stringify(meta),
      "labels.json": JSON.stringify({ facts: "none" }),
    });

    expect(readFixtures(root).skipped[0]?.reason).toContain("schema");
  });

  it("reads them in alphabetical order and finds none in a directory that is not there", () => {
    for (const id of ["z", "m"]) {
      write(id, {
        "page.html": "x",
        "meta.json": JSON.stringify(meta),
        "labels.json": JSON.stringify(labels),
      });
    }

    expect(readFixtures(root).fixtures.map(({ id }) => id)).toEqual(["m", "z"]);
    expect(readFixtures(`${root}/nowhere`)).toEqual({ fixtures: [], skipped: [] });
  });
});

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { captureFixture } from ".";

let root = "";

beforeEach(() => {
  root = mkdtempSync(`${tmpdir()}/evalCapture`);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const serving =
  (body: string, status = 200) =>
  (): Promise<Response> =>
    Promise.resolve(new Response(body, { status }));

describe("captureFixture", () => {
  it("saves the page, its source and an empty labels file", async () => {
    const result = await captureFixture(
      "https://shop.example/p",
      "pixel",
      root,
      "2026-10-26",
      serving("<p>hi</p>"),
    );

    expect(result).toEqual({ saved: true, directory: `${root}/pixel` });
    expect(readFileSync(`${root}/pixel/page.html`, "utf8")).toBe("<p>hi</p>");
    expect(JSON.parse(readFileSync(`${root}/pixel/meta.json`, "utf8"))).toEqual({
      url: "https://shop.example/p",
      savedOn: "2026-10-26",
    });
    expect(JSON.parse(readFileSync(`${root}/pixel/labels.json`, "utf8"))).toMatchObject({
      facts: [],
    });
  });

  it("changes nothing for an id that exists", async () => {
    mkdirSync(`${root}/pixel`);

    const result = await captureFixture("https://shop.example/p", "pixel", root, "d", serving("x"));

    expect(result).toEqual({ saved: false, reason: "a fixture named pixel already exists" });
    expect(existsSync(`${root}/pixel/page.html`)).toBe(false);
  });

  it("saves nothing for a page the server refuses", async () => {
    const result = await captureFixture(
      "https://shop.example/p",
      "pixel",
      root,
      "d",
      serving("no", 403),
    );

    expect(result).toEqual({ saved: false, reason: "https://shop.example/p answered HTTP 403" });
    expect(existsSync(`${root}/pixel`)).toBe(false);
  });
});

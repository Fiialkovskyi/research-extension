import { describe, expect, it } from "vitest";

import { resolvePagePath } from ".";

const ROOT = "/suite/pages/";

describe("resolvePagePath", () => {
  it("serves a page from the pages directory as HTML", () => {
    expect(resolvePagePath(ROOT, "/a.html")).toEqual({
      path: "/suite/pages/a.html",
      contentType: "text/html; charset=utf-8",
    });
  });

  it("ignores a query string", () => {
    expect(resolvePagePath(ROOT, "/b.html?x=1")?.path).toBe("/suite/pages/b.html");
  });

  it("refuses a path that climbs out of the pages directory", () => {
    expect(resolvePagePath(ROOT, "/../secret.html")).toBeUndefined();
    expect(resolvePagePath(ROOT, "/%2e%2e/secret.html")).toBeUndefined();
  });

  it("refuses a type it does not serve", () => {
    expect(resolvePagePath(ROOT, "/a.js")).toBeUndefined();
  });
});

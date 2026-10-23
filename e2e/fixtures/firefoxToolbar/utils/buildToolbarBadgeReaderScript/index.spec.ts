import { describe, expect, it } from "vitest";

import { buildToolbarBadgeReaderScript } from ".";

/** A stand-in for a chrome element carrying the given attributes, and one child. */
const element = (badge: string | null, child: unknown = null) => ({
  hasAttribute: (name: string) => name === "badge" && badge !== null,
  getAttribute: (name: string) => (name === "badge" ? badge : null),
  querySelector: () => child,
});

const run = (widget: unknown): string =>
  new Function(
    "document",
    buildToolbarBadgeReaderScript("research-graph_example_org-browser-action"),
  )({ getElementById: () => widget }) as string;

describe("buildToolbarBadgeReaderScript", () => {
  it("names the add-on's own widget", () => {
    expect(buildToolbarBadgeReaderScript("w-browser-action")).toContain('"w-browser-action"');
  });

  it("reads the badge off the action button inside the widget", () => {
    expect(run(element(null, element("!")))).toBe("!");
  });

  it("reads the badge off the widget itself, where a release puts it there", () => {
    expect(run(element("!"))).toBe("!");
  });

  it("reads no badge as empty, and a missing widget too", () => {
    expect(run(element(null))).toBe("");
    expect(run(null)).toBe("");
  });
});

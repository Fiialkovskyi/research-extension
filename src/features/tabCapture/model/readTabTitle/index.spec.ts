import { describe, expect, it } from "vitest";

import { readTabTitle } from ".";

const tab = { id: 7, incognito: false };

describe("readTabTitle", () => {
  it("uses the tab's title once the tab shows the page", () => {
    expect(readTabTitle({ ...tab, url: "https://a.org/", title: "A" }, "https://a.org/")).toBe("A");
  });

  it("does not give the page the previous page's title", () => {
    expect(readTabTitle({ ...tab, url: "https://old.org/", title: "Old" }, "https://a.org/")).toBe(
      "https://a.org/",
    );
  });

  it("falls back to the URL when the tab has no title yet", () => {
    expect(readTabTitle({ ...tab, url: "https://a.org/", title: " " }, "https://a.org/")).toBe(
      "https://a.org/",
    );
    expect(readTabTitle({ ...tab, url: "https://a.org/" }, "https://a.org/")).toBe(
      "https://a.org/",
    );
  });
});

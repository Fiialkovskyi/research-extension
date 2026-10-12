import { describe, expect, it } from "vitest";

import { readCaptureTab } from ".";

describe("readCaptureTab", () => {
  it("keeps what capture reads and drops the rest", () => {
    const tab = {
      id: 7,
      url: "https://example.org/",
      title: "Example",
      groupId: 42,
      openerTabId: 3,
      incognito: false,
      active: true,
      index: 2,
    };

    expect(readCaptureTab(tab)).toEqual({
      id: 7,
      url: "https://example.org/",
      title: "Example",
      groupId: 42,
      openerTabId: 3,
      incognito: false,
    });
  });

  it("leaves absent fields absent", () => {
    expect(readCaptureTab({ id: 7, incognito: true })).toEqual({ id: 7, incognito: true });
  });

  it("refuses a tab without an id", () => {
    expect(() => readCaptureTab({ incognito: false })).toThrow("without an id");
  });
});

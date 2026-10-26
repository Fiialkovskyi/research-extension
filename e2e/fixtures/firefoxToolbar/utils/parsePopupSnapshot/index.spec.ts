import { describe, expect, it } from "vitest";

import { parsePopupSnapshot } from "./index";

const SNAPSHOT = JSON.stringify({
  uri: "moz-extension://uuid/popup.html",
  panelVisible: true,
  panelWidth: 320,
  backgroundColor: "rgb(255, 255, 255)",
  textColor: "rgb(15, 23, 42)",
  activeSession: null,
  sessionOptions: [],
  hasSessionForm: true,
  hasOpenMap: false,
  pageCount: null,
  savedSessions: [],
  leftOff: null,
  reattachOffer: null,
  setupBanner: null,
  activityState: null,
  activityStrip: null,
});

describe("parsePopupSnapshot", () => {
  it("reads every field the assertions rely on", () => {
    expect(parsePopupSnapshot(SNAPSHOT)).toEqual({
      uri: "moz-extension://uuid/popup.html",
      panelVisible: true,
      panelWidth: 320,
      backgroundColor: "rgb(255, 255, 255)",
      textColor: "rgb(15, 23, 42)",
      activeSession: null,
      sessionOptions: [],
      hasSessionForm: true,
      hasOpenMap: false,
      pageCount: null,
      savedSessions: [],
      leftOff: null,
      reattachOffer: null,
      setupBanner: null,
      activityState: null,
      activityStrip: null,
    });
  });

  it("reads a panel that is not visible", () => {
    const raw = JSON.stringify({ ...JSON.parse(SNAPSHOT), panelVisible: false });

    expect(parsePopupSnapshot(raw).panelVisible).toBe(false);
  });

  it("reads the active session the popup announces", () => {
    const raw = JSON.stringify({
      ...JSON.parse(SNAPSHOT),
      activeSession: "Session “Motors” is active.",
      hasSessionForm: false,
    });

    expect(parsePopupSnapshot(raw)).toMatchObject({
      activeSession: "Session “Motors” is active.",
      hasSessionForm: false,
    });
  });

  it("reads the sessions the picker lists", () => {
    const raw = JSON.stringify({
      ...JSON.parse(SNAPSHOT),
      sessionOptions: ["Motors · 2 pages", "Batteries · 1 page"],
    });

    expect(parsePopupSnapshot(raw).sessionOptions).toEqual([
      "Motors · 2 pages",
      "Batteries · 1 page",
    ]);
  });

  it("rejects a JSON string that is not a snapshot", () => {
    expect(() => parsePopupSnapshot('{"uri":"moz-extension://uuid/popup.html"}')).toThrow();
  });

  it("explains itself when the input is not a string", () => {
    expect(() => parsePopupSnapshot(null)).toThrow(
      /Expected the popup snapshot as a JSON string, got object/,
    );
  });
});

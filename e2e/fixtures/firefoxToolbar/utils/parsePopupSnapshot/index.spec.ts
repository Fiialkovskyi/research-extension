import { describe, expect, it } from "vitest";

import { parsePopupSnapshot } from "./index";

const SNAPSHOT = JSON.stringify({
  uri: "moz-extension://uuid/popup.html",
  greeting: "Hello World",
  greetingVisible: true,
  panelWidth: 320,
  backgroundColor: "rgb(255, 255, 255)",
  textColor: "rgb(15, 23, 42)",
  activeSession: null,
  closedSession: null,
  hasSessionForm: true,
});

describe("parsePopupSnapshot", () => {
  it("reads every field the assertions rely on", () => {
    expect(parsePopupSnapshot(SNAPSHOT)).toEqual({
      uri: "moz-extension://uuid/popup.html",
      greeting: "Hello World",
      greetingVisible: true,
      panelWidth: 320,
      backgroundColor: "rgb(255, 255, 255)",
      textColor: "rgb(15, 23, 42)",
      activeSession: null,
      closedSession: null,
      hasSessionForm: true,
    });
  });

  it("keeps a missing greeting as null rather than inventing an empty string", () => {
    const raw = JSON.stringify({ ...JSON.parse(SNAPSHOT), greeting: null, greetingVisible: false });

    expect(parsePopupSnapshot(raw).greeting).toBeNull();
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

  it("reads the closed session the popup names beside the form", () => {
    const raw = JSON.stringify({
      ...JSON.parse(SNAPSHOT),
      closedSession: "Session “Motors” is closed.",
    });

    expect(parsePopupSnapshot(raw)).toMatchObject({
      closedSession: "Session “Motors” is closed.",
      hasSessionForm: true,
    });
  });

  it("rejects a JSON string that is not a snapshot", () => {
    expect(() => parsePopupSnapshot('{"greeting":"Hello World"}')).toThrow();
  });

  it("explains itself when the input is not a string", () => {
    expect(() => parsePopupSnapshot(null)).toThrow(
      /Expected the popup snapshot as a JSON string, got object/,
    );
  });
});

import { describe, expect, it } from "vitest";

import { parsePopupSnapshot } from "./index";

const SNAPSHOT = JSON.stringify({
  uri: "moz-extension://uuid/popup.html",
  greeting: "Hello World",
  greetingVisible: true,
  panelWidth: 320,
  backgroundColor: "rgb(255, 255, 255)",
  textColor: "rgb(15, 23, 42)",
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
    });
  });

  it("keeps a missing greeting as null rather than inventing an empty string", () => {
    const raw = JSON.stringify({ greeting: null, greetingVisible: false });

    expect(parsePopupSnapshot(raw).greeting).toBeNull();
  });

  it("explains itself when the input is not a string", () => {
    expect(() => parsePopupSnapshot(null)).toThrow(
      /Expected the popup snapshot as a JSON string, got object/,
    );
  });
});

import { describe, expect, it } from "vitest";

import { POPUP_SNAPSHOT_SCRIPT, buildPopupReaderScript } from "./index";
import { POPUP_BROWSER_SELECTOR, UI_TIMEOUT_MS } from "../../constants";

describe("POPUP_SNAPSHOT_SCRIPT", () => {
  it("reads the elements the popup marks for testing", () => {
    expect(POPUP_SNAPSHOT_SCRIPT).toContain('[data-testid="popup-panel"]');
    expect(POPUP_SNAPSHOT_SCRIPT).toContain('[data-testid="greeting"]');
    expect(POPUP_SNAPSHOT_SCRIPT).toContain('[data-testid="session-active"]');
    expect(POPUP_SNAPSHOT_SCRIPT).toContain('[data-testid="group-form"]');
    expect(POPUP_SNAPSHOT_SCRIPT).toContain('[data-testid="session-page-count"]');
    expect(POPUP_SNAPSHOT_SCRIPT).toContain('[role="treeitem"]');
    expect(POPUP_SNAPSHOT_SCRIPT).toContain('[data-testid="unread-count"]');
    expect(POPUP_SNAPSHOT_SCRIPT).toContain('[data-testid="unread-page"]');
    expect(POPUP_SNAPSHOT_SCRIPT).toContain('[data-testid="saved-session"]');
    expect(POPUP_SNAPSHOT_SCRIPT).toContain('[data-testid="left-off"]');
    expect(POPUP_SNAPSHOT_SCRIPT).toContain('[data-testid="reattach-offer"]');
  });

  // Only simple values survive the actor boundary reliably.
  it("returns its result as JSON rather than an object", () => {
    expect(POPUP_SNAPSHOT_SCRIPT).toContain("JSON.stringify");
  });
});

describe("buildPopupReaderScript", () => {
  it("targets the XUL browser that hosts an extension popup", () => {
    expect(buildPopupReaderScript()).toContain(JSON.stringify(POPUP_BROWSER_SELECTOR));
  });

  it("goes through the Marionette actor, the only way into a remote XUL browser", () => {
    expect(buildPopupReaderScript()).toContain(
      'getActor("MarionetteCommands").sendQuery("MarionetteCommandsParent:executeScript"',
    );
  });

  it("resolves with null before the popup has loaded, so the caller can poll", () => {
    expect(buildPopupReaderScript()).toContain("done(null)");
  });

  it("only treats a moz-extension document as the popup", () => {
    expect(buildPopupReaderScript()).toContain('startsWith("moz-extension://")');
  });

  it("embeds the inner script safely, quotes and all", () => {
    const inner = `return "it's \\"quoted\\"";`;

    expect(buildPopupReaderScript(inner)).toContain(JSON.stringify(inner));
  });

  it("gives the actor the same timeout budget as the outer UI wait, so it never fires first", () => {
    expect(buildPopupReaderScript()).toContain(`timeout: ${UI_TIMEOUT_MS},`);
  });
});

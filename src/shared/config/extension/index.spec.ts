import { describe, expect, it } from "vitest";

import { EXTENSION_ID, FIREFOX_MIN_VERSION, POPUP_PATH } from "./index";

describe("extension config", () => {
  it("pins the add-on id used by the manifest and the e2e harness", () => {
    expect(EXTENSION_ID).toBe("research-graph@example.org");
  });

  it("pins the minimum Firefox version required by the target spec", () => {
    expect(FIREFOX_MIN_VERSION).toBe("140.0");
  });

  it("pins the popup document path inside the package", () => {
    expect(POPUP_PATH).toBe("popup.html");
  });
});

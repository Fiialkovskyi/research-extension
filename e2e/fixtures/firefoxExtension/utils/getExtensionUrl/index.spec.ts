import { describe, expect, it } from "vitest";

import { POPUP_PATH } from "@/shared/config";

import { getExtensionUrl } from "./index";
import { PINNED_EXTENSION_UUID } from "../../constants";

describe("getExtensionUrl", () => {
  it("builds a moz-extension address from the pinned UUID", () => {
    expect(getExtensionUrl("options.html")).toBe(
      `moz-extension://${PINNED_EXTENSION_UUID}/options.html`,
    );
  });

  it("accepts an explicit UUID, for a profile pinned to something else", () => {
    expect(getExtensionUrl("options.html", "11111111-2222-3333-4444-555555555555")).toBe(
      "moz-extension://11111111-2222-3333-4444-555555555555/options.html",
    );
  });

  it("strips leading slashes so a rooted path does not produce a doubled separator", () => {
    expect(getExtensionUrl("/popup.html")).toBe(getExtensionUrl("popup.html"));
  });

  it("keeps nested paths intact", () => {
    expect(getExtensionUrl("pages/map.html")).toContain("/pages/map.html");
  });

  it("addresses the popup document the manifest declares", () => {
    expect(getExtensionUrl(POPUP_PATH)).toBe(
      `moz-extension://${PINNED_EXTENSION_UUID}/${POPUP_PATH}`,
    );
  });
});

import { describe, expect, it } from "vitest";

import { buildProfilePreferences } from "./index";
import { EXTENSION_ID } from "@/shared/config/extension";
import { PINNED_EXTENSION_UUID } from "../constants";

describe("buildProfilePreferences", () => {
  it("maps the add-on id onto the pinned UUID, as Firefox expects the pref encoded", () => {
    const prefs = buildProfilePreferences("addon@example.test", PINNED_EXTENSION_UUID);

    expect(JSON.parse(prefs["extensions.webextensions.uuids"])).toEqual({
      "addon@example.test": PINNED_EXTENSION_UUID,
    });
  });

  it("encodes the mapping as a string, because Firefox stores that pref as JSON text", () => {
    const prefs = buildProfilePreferences();

    expect(typeof prefs["extensions.webextensions.uuids"]).toBe("string");
  });

  it("lifts the signature requirement so an unsigned local build can install", () => {
    expect(buildProfilePreferences()["xpinstall.signatures.required"]).toBe(false);
  });

  it("defaults to this project's add-on id", () => {
    const prefs = buildProfilePreferences();

    expect(JSON.parse(prefs["extensions.webextensions.uuids"])).toHaveProperty(EXTENSION_ID);
  });

  it("refuses a malformed UUID instead of letting Firefox silently pick its own", () => {
    expect(() => buildProfilePreferences(EXTENSION_ID, "not-a-uuid")).toThrow(
      /canonical lowercase UUID/,
    );
  });
});

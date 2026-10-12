import { describe, expect, it } from "vitest";

import { buildFirefoxCapabilities, RESTART_PREFERENCES } from ".";
import { buildProfilePreferences } from "../buildProfilePreferences";

describe("buildFirefoxCapabilities", () => {
  it("runs headless in a throwaway profile by default", () => {
    expect(buildFirefoxCapabilities({ headless: true })).toMatchObject({
      browserName: "firefox",
      "moz:firefoxOptions": { args: ["-headless"], prefs: buildProfilePreferences() },
    });
  });

  it("runs in a kept profile with extra preferences when asked", () => {
    const capabilities = buildFirefoxCapabilities({
      headless: false,
      profileDirectory: "/tmp/profile",
      preferences: RESTART_PREFERENCES,
    });

    expect(capabilities["moz:firefoxOptions"]).toEqual({
      args: ["-profile", "/tmp/profile"],
      prefs: { ...buildProfilePreferences(), ...RESTART_PREFERENCES },
    });
  });
});

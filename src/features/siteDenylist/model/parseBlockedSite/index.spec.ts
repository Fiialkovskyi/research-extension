import { describe, expect, it } from "vitest";

import { parseBlockedSite } from ".";

describe("parseBlockedSite", () => {
  it("reads a bare host", () => {
    expect(parseBlockedSite("myclinic.example")).toBe("myclinic.example");
  });

  it("reads the host of a pasted URL", () => {
    expect(parseBlockedSite(" https://portal.myclinic.example/appointments?id=4 ")).toBe(
      "portal.myclinic.example",
    );
  });

  it("drops case, a leading www. and a trailing dot", () => {
    expect(parseBlockedSite("WWW.MyClinic.Example.")).toBe("myclinic.example");
  });

  it.each(["not a site", "", "localhost", "intranet", "192.168.0.1", "http://[::1]/", "https://"])(
    "refuses %j",
    (input) => {
      expect(parseBlockedSite(input)).toBeUndefined();
    },
  );
});

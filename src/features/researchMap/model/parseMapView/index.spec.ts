import { describe, expect, it } from "vitest";

import { parseMapView } from ".";

describe("parseMapView", () => {
  it("reads the view the address names", () => {
    expect(parseMapView("#history")).toBe("history");
    expect(parseMapView("#anchors")).toBe("anchors");
    expect(parseMapView("telemetry")).toBe("telemetry");
  });

  it("opens the tree for an address that names no view", () => {
    expect(parseMapView("")).toBe("tree");
    expect(parseMapView("#nothing")).toBe("tree");
  });
});

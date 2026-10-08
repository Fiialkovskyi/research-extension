import { describe, expect, it } from "vitest";

import { assertPlacedOnNavBar } from "./index";
import { NAV_BAR_AREA } from "../../../constants";

describe("assertPlacedOnNavBar", () => {
  it("accepts the navigation bar", () => {
    expect(() => assertPlacedOnNavBar(NAV_BAR_AREA)).not.toThrow();
  });

  it("rejects the unified-extensions panel, where the button is not clickable", () => {
    expect(() => assertPlacedOnNavBar("unified-extensions-area")).toThrow(
      /not on the navigation bar \(area: unified-extensions-area\)/,
    );
  });

  it("reports an unplaced widget readably rather than as a bare null", () => {
    expect(() => assertPlacedOnNavBar(null)).toThrow(/area: null/);
  });
});

import { describe, expect, it } from "vitest";

import { IS_IN_BROWSER_BACKEND_ENABLED } from "./constants";

describe("model backends", () => {
  it("keeps the in-extension backend off, so the manifest names no model host", () => {
    // Turning it on adds two host permissions and two `connect-src` origins to
    // the package: a spec-level change, never a side effect of a tidy-up.
    expect(IS_IN_BROWSER_BACKEND_ENABLED).toBe(false);
  });
});

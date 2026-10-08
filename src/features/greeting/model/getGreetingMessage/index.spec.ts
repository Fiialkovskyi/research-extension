import { describe, expect, it } from "vitest";

import { getGreetingMessage } from "./index";

describe("getGreetingMessage", () => {
  it("returns the greeting the popup must render", () => {
    expect(getGreetingMessage()).toBe("Hello World");
  });
});

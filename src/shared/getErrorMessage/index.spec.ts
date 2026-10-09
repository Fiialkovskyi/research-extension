import { describe, expect, it } from "vitest";

import { getErrorMessage } from ".";

describe("getErrorMessage", () => {
  it("reads the message of an Error", () => {
    expect(getErrorMessage(new Error("the hub answered 404."))).toBe("the hub answered 404.");
  });

  it("reads the message of an Error subclass", () => {
    expect(getErrorMessage(new TypeError("not a function"))).toBe("not a function");
  });

  it("turns a thrown non-Error into text rather than losing it", () => {
    expect(getErrorMessage("plain string")).toBe("plain string");
    expect(getErrorMessage(42)).toBe("42");
    expect(getErrorMessage(undefined)).toBe("undefined");
  });
});

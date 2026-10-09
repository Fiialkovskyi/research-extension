import { describe, expect, it } from "vitest";

import { readMessageField } from ".";

describe("readMessageField", () => {
  it("reads a string field", () => {
    expect(readMessageField({ id: "abc" }, "id")).toBe("abc");
  });

  it("reports a field that is absent", () => {
    expect(readMessageField({ type: "worker.ping" }, "id")).toBeUndefined();
  });

  it.each([
    ["a number", 7],
    ["null", null],
    ["an object", {}],
    ["an array", []],
  ])("reports a field holding %s as absent", (_label, id) => {
    expect(readMessageField({ id }, "id")).toBeUndefined();
  });

  it.each([
    ["a primitive", 42],
    ["null", null],
    ["undefined", undefined],
    ["a string", "message"],
  ])("reports nothing for %s, which has no fields at all", (_label, candidate) => {
    expect(readMessageField(candidate, "id")).toBeUndefined();
  });

  it("does not read an inherited property as the message's own field", () => {
    expect(readMessageField({}, "toString")).toBeUndefined();
  });
});

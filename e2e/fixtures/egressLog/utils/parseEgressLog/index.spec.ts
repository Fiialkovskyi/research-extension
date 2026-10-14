import { describe, expect, it } from "vitest";

import { parseEgressLog } from ".";

describe("parseEgressLog", () => {
  it("reads the recorded requests", () => {
    expect(parseEgressLog('[{"url":"https://a.example/","type":11}]')).toEqual([
      { url: "https://a.example/", type: 11 },
    ]);
  });

  it("refuses anything but a JSON string of requests", () => {
    expect(() => parseEgressLog(3)).toThrow("JSON string");
    expect(() => parseEgressLog('[{"url":1}]')).toThrow();
  });
});

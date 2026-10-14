import { describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({
  browser: {
    executeScript: vi.fn(() => Promise.resolve('[{"url":"https://a.example/","type":11}]')),
  },
}));

vi.mock("@wdio/globals", () => ({ browser }));

const { readEgressLog } = await import("./index");

describe("readEgressLog", () => {
  it("reads the recorded requests from the chrome context", async () => {
    expect(await readEgressLog()).toEqual([{ url: "https://a.example/", type: 11 }]);
  });
});

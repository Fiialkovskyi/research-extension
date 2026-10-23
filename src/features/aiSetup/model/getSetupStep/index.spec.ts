import { describe, expect, it } from "vitest";

import { getSetupStep } from ".";
import type { SetupServerState } from "./types";

const step = (server: SetupServerState, overrides = {}) =>
  getSetupStep({ server, isSetUp: false, isTurningOn: false, ...overrides });

describe("getSetupStep", () => {
  it("checks before it has heard from Ollama, or before setup is recorded as started", () => {
    expect(step("loading")).toBe("checking");
    expect(step("notConnected")).toBe("checking");
  });

  it("asks the user to get or open Ollama while nothing answers", () => {
    expect(step("unreachable")).toBe("getOllama");
  });

  it("asks to allow the extension only when Ollama refuses it", () => {
    expect(step("refused")).toBe("allowExtension");
    expect(step("running")).not.toBe("allowExtension");
  });

  it("offers to turn AI on once Ollama answers", () => {
    expect(step("running")).toBe("turnOn");
  });

  it("follows the turning on, wherever the server stands", () => {
    expect(step("running", { isTurningOn: true })).toBe("turningOn");
    expect(step("unreachable", { isTurningOn: true })).toBe("turningOn");
  });

  it("skips to done when AI is already set up, even with Ollama closed", () => {
    expect(step("unreachable", { isSetUp: true })).toBe("done");
    expect(step("running", { isSetUp: true })).toBe("done");
  });
});

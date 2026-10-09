import { describe, expect, it } from "vitest";

import { INITIAL_OPTIONS_STATE, type OptionsEvent, reduceOptionsState } from ".";
import type { RuntimeCapabilities } from "@/features/inference";
import type { InstalledModelSummary } from "@/features/modelRegistry";

const capabilities: RuntimeCapabilities = {
  availableDevices: ["webgpu", "wasm"],
  crossOriginIsolated: false,
  threadCount: 1,
};

const progress = {
  path: "onnx/model_quantized.onnx",
  completedFiles: 1,
  totalFiles: 5,
  completedBytes: 1,
  totalBytes: 2,
};

const summary = { ref: "a", repository: "owner/model" } as InstalledModelSummary;

const fold = (...events: OptionsEvent[]) =>
  events.reduce(reduceOptionsState, INITIAL_OPTIONS_STATE);

describe("reduceOptionsState", () => {
  it("starts with nothing installed, nothing running and no measurement", () => {
    expect(INITIAL_OPTIONS_STATE).toEqual({
      models: [],
      install: { status: "idle" },
      busy: false,
      device: "wasm",
      probes: [],
      blockedOrigins: [],
    });
  });

  it("defaults to the software path, which every supported platform has", () => {
    expect(INITIAL_OPTIONS_STATE.device).toBe("wasm");
  });

  it("records what the installation can run", () => {
    expect(
      fold({ type: "inference.capabilities", payload: { ...capabilities } }).capabilities,
    ).toEqual(capabilities);
  });

  it("records the installed models", () => {
    expect(fold({ type: "model.listed", payload: { models: [summary] } }).models).toEqual([
      summary,
    ]);
  });

  it("surfaces a refusal rather than swallowing it", () => {
    expect(fold({ type: "inference.failed", payload: { reason: "no worker" } }).problem).toBe(
      "no worker",
    );
  });

  it("shows an install as running the moment it is asked for", () => {
    expect(fold({ type: "install-requested", repository: "owner/model" }).install.status).toBe(
      "running",
    );
  });

  it("tracks progress while an install runs", () => {
    const state = fold(
      { type: "install-requested", repository: "owner/model" },
      { type: "model.installProgress", payload: progress },
    );

    expect(state.install).toEqual({ status: "running", progress });
  });

  it("concludes an install as installed", () => {
    const state = fold(
      { type: "install-requested", repository: "owner/model" },
      { type: "model.installed", payload: { ref: "owner/model@abc", diskBytes: 10 } },
    );

    expect(state.install).toMatchObject({ status: "installed", ref: "owner/model@abc" });
  });

  it("concludes an install as failed, carrying the reason", () => {
    const state = fold(
      { type: "install-requested", repository: "owner/model" },
      { type: "model.installFailed", payload: { repository: "owner/model", reason: "digest" } },
    );

    expect(state.install).toMatchObject({ status: "failed", reason: "digest" });
  });

  it("ignores progress that arrives after a failure", () => {
    // A streamed protocol really does deliver these out of order, and
    // resurrecting a finished attempt would claim something untrue.
    const state = fold(
      { type: "install-requested", repository: "owner/model" },
      { type: "model.installFailed", payload: { repository: "owner/model", reason: "digest" } },
      { type: "model.installProgress", payload: progress },
    );

    expect(state.install).toMatchObject({ status: "failed" });
  });

  it("ignores progress that arrives before anything was asked for", () => {
    expect(fold({ type: "model.installProgress", payload: progress }).install.status).toBe("idle");
  });

  it("clears a previous outcome when a second install starts", () => {
    const state = fold(
      { type: "install-requested", repository: "owner/model" },
      { type: "model.installFailed", payload: { repository: "owner/model", reason: "digest" } },
      { type: "install-requested", repository: "owner/other" },
    );

    expect(state.install.status).toBe("running");
  });

  it("clears a previous refusal when a new install starts", () => {
    const state = fold(
      { type: "inference.failed", payload: { reason: "no worker" } },
      { type: "install-requested", repository: "owner/model" },
    );

    expect(state.problem).toBeUndefined();
  });

  it("keeps the model list across an install, so the surface does not blank", () => {
    const state = fold(
      { type: "model.listed", payload: { models: [summary] } },
      { type: "install-requested", repository: "owner/model" },
      { type: "model.installProgress", payload: progress },
    );

    expect(state.models).toEqual([summary]);
  });

  it("keeps reported capabilities across an install", () => {
    const state = fold(
      { type: "inference.capabilities", payload: { ...capabilities } },
      { type: "install-requested", repository: "owner/model" },
    );

    expect(state.capabilities).toEqual(capabilities);
  });

  it("never mutates the state it was given", () => {
    const before = { ...INITIAL_OPTIONS_STATE };

    reduceOptionsState(INITIAL_OPTIONS_STATE, {
      type: "model.listed",
      payload: { models: [summary] },
    });

    expect(INITIAL_OPTIONS_STATE).toEqual(before);
  });

  it("marks the surface busy while an install runs, and free when it ends", () => {
    const running = fold({ type: "install-requested", repository: "owner/model" });

    expect(running.busy).toBe(true);
    expect(
      reduceOptionsState(running, {
        type: "model.installed",
        payload: { ref: "a@b", diskBytes: 1 },
      }).busy,
    ).toBe(false);
  });

  it("frees the surface when an install fails", () => {
    const state = fold(
      { type: "install-requested", repository: "owner/model" },
      { type: "model.installFailed", payload: { repository: "owner/model", reason: "digest" } },
    );

    expect(state.busy).toBe(false);
  });

  it("records the probes an activation ran", () => {
    const probes = [{ name: "reproduces a vector", passed: true, detail: "0.99999" }];

    const state = fold(
      { type: "activation-requested", ref: "a" },
      { type: "model.activated", payload: { ref: "a", active: true, probes } },
    );

    expect(state.probes).toEqual(probes);
    expect(state.busy).toBe(false);
  });

  it("reports a refusal even though the request itself succeeded", () => {
    // The model was not activated; saying nothing would imply it was.
    const state = fold(
      { type: "activation-requested", ref: "a" },
      {
        type: "model.activated",
        payload: { ref: "a", active: false, reason: "4 of 20 pairs", probes: [] },
      },
    );

    expect(state.problem).toBe("4 of 20 pairs");
  });

  it("clears a previous refusal when a passing activation follows", () => {
    const state = fold(
      {
        type: "model.activated",
        payload: { ref: "a", active: false, reason: "an older failure", probes: [] },
      },
      { type: "model.activated", payload: { ref: "a", active: true, probes: [] } },
    );

    expect(state.problem).toBeUndefined();
  });

  it("drops stale probes when a new activation starts", () => {
    const state = fold(
      {
        type: "model.activated",
        payload: {
          ref: "a",
          active: true,
          probes: [{ name: "old", passed: true, detail: "" }],
        },
      },
      { type: "activation-requested", ref: "a" },
    );

    expect(state.probes).toEqual([]);
  });

  it("records a measurement with the thread count it has to be read beside", () => {
    const measured = {
      ref: "a",
      device: "wasm" as const,
      chunkCount: 40,
      durationMs: 2_000,
      chunksPerSecond: 20,
      loadDurationMs: 1_500,
      meetsBudget: true,
      threadCount: 1,
    };

    const state = fold(
      { type: "benchmark-requested", ref: "a" },
      { type: "benchmark.measured", payload: measured },
    );

    expect(state.benchmark).toMatchObject({ chunksPerSecond: 20, threadCount: 1 });
    expect(state.busy).toBe(false);
  });

  it("discards a measurement when the device changes under it", () => {
    // It was taken on the other path, so leaving it on screen would invite
    // reading it as this one's.
    const state = fold(
      {
        type: "benchmark.measured",
        payload: {
          ref: "a",
          device: "wasm",
          chunkCount: 1,
          durationMs: 1,
          chunksPerSecond: 1,
          loadDurationMs: 1,
          meetsBudget: false,
          threadCount: 1,
        },
      },
      { type: "device-selected", device: "webgpu" },
    );

    expect(state.benchmark).toBeUndefined();
    expect(state.device).toBe("webgpu");
  });

  it("reports a failed measurement and frees the surface", () => {
    const state = fold(
      { type: "benchmark-requested", ref: "a" },
      { type: "benchmark.failed", payload: { ref: "a", reason: "no model loaded" } },
    );

    expect(state.problem).toBe("no model loaded");
    expect(state.busy).toBe(false);
  });

  it("frees the surface when the background refuses outright", () => {
    const state = fold(
      { type: "activation-requested", ref: "a" },
      { type: "inference.failed", payload: { reason: "worker crashed" } },
    );

    expect(state.busy).toBe(false);
  });

  it("records what the policy permits and what it refused", () => {
    const state = fold({
      type: "diagnostics.report",
      payload: {
        permittedOrigins: ["https://huggingface.co", "https://*.hf.co"],
        blocked: [{ origin: "https://cdn.jsdelivr.net", directive: "connect-src" }],
      },
    });

    expect(state.permittedOrigins).toEqual(["https://huggingface.co", "https://*.hf.co"]);
    expect(state.blockedOrigins).toHaveLength(1);
  });

  it("records an empty refusal list, which is a result rather than an absence", () => {
    const state = fold({
      type: "diagnostics.report",
      payload: { permittedOrigins: ["https://huggingface.co"], blocked: [] },
    });

    expect(state.permittedOrigins).toHaveLength(1);
    expect(state.blockedOrigins).toEqual([]);
  });
});

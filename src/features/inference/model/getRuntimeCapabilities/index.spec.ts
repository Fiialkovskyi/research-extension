import { afterEach, describe, expect, it, vi } from "vitest";

import { getRuntimeCapabilities } from ".";

const noGpu = undefined;
const withGpu = { requestAdapter: () => Promise.resolve({}) };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getRuntimeCapabilities", () => {
  it("reports a single thread when the realm is not cross-origin isolated", async () => {
    // The Firefox extension case: no isolation, so no SharedArrayBuffer.
    expect((await getRuntimeCapabilities(noGpu, false)).threadCount).toBe(1);
  });

  it("reports the machine's concurrency only when isolation allows threads", async () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 8 });

    expect((await getRuntimeCapabilities(noGpu, true)).threadCount).toBe(8);
  });

  it("reports isolation honestly rather than inferring it from the thread count", async () => {
    expect((await getRuntimeCapabilities(noGpu, false)).crossOriginIsolated).toBe(false);
    expect((await getRuntimeCapabilities(noGpu, true)).crossOriginIsolated).toBe(true);
  });

  it("reports the accelerated path when an adapter is granted", async () => {
    expect((await getRuntimeCapabilities(withGpu, false)).availableDevices).toEqual([
      "webgpu",
      "wasm",
    ]);
  });

  it("reports only the software path where no GPU is exposed", async () => {
    expect((await getRuntimeCapabilities(noGpu, false)).availableDevices).toEqual(["wasm"]);
  });

  it("can report acceleration and a single thread together, which is our actual case", async () => {
    const capabilities = await getRuntimeCapabilities(withGpu, false);

    expect(capabilities.availableDevices).toContain("webgpu");
    expect(capabilities.threadCount).toBe(1);
  });
});

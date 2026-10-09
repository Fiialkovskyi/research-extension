import { describe, expect, it, vi } from "vitest";

import { getAvailableDevices } from ".";

describe("getAvailableDevices", () => {
  it("reports only WebAssembly where the platform exposes no GPU", async () => {
    expect(await getAvailableDevices(undefined)).toEqual(["wasm"]);
  });

  it("reports WebGPU first when an adapter is granted", async () => {
    const gpu = { requestAdapter: vi.fn().mockResolvedValue({}) };

    expect(await getAvailableDevices(gpu)).toEqual(["webgpu", "wasm"]);
  });

  it("does not claim WebGPU when the object exists but grants no adapter", async () => {
    const gpu = { requestAdapter: vi.fn().mockResolvedValue(null) };

    expect(await getAvailableDevices(gpu)).toEqual(["wasm"]);
  });

  it("does not claim WebGPU when requesting an adapter rejects", async () => {
    const gpu = { requestAdapter: vi.fn().mockRejectedValue(new Error("no adapter")) };

    expect(await getAvailableDevices(gpu)).toEqual(["wasm"]);
  });

  it("always reports WebAssembly, whose runtime ships in the package", async () => {
    const withGpu = await getAvailableDevices({ requestAdapter: () => Promise.resolve({}) });

    expect(withGpu).toContain("wasm");
    expect(await getAvailableDevices(undefined)).toContain("wasm");
  });
});

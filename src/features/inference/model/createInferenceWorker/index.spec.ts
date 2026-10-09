import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInferenceWorker } from ".";
import { INFERENCE_REQUEST_TIMEOUT_MS } from "../../constants";
import { buildRpcMessage } from "../../../../shared/rpc";

/**
 * Stands in for a real worker. jsdom has none, and the behaviour under test is
 * this channel's — correlation, timeouts, failure propagation — not the
 * browser's threading.
 */
class FakeWorker {
  static instances: FakeWorker[] = [];

  readonly sent: { id: string; type: string }[] = [];
  terminated = false;

  private readonly listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor(
    readonly url: string,
    readonly options?: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  postMessage(message: { id: string; type: string }): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Delivers a message as though the worker had posted it back. */
  deliver(data: unknown): void {
    for (const listener of this.listeners.get("message") ?? []) {
      listener({ data });
    }
  }

  crash(message: string): void {
    for (const listener of this.listeners.get("error") ?? []) {
      listener({ message });
    }
  }

  /** Id of the nth request this worker received. */
  idOf(index: number): string {
    const message = this.sent[index];

    if (message === undefined) {
      throw new Error(`No request at index ${index}`);
    }

    return message.id;
  }
}

const respondTo = (id: string, payload: unknown) => ({
  ...buildRpcMessage("worker.pong", payload),
  id,
});

const pong = { availableDevices: ["wasm"], crossOriginIsolated: false, threadCount: 1 };

let worker: FakeWorker;

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const createChannel = () => {
  const channel = createInferenceWorker("moz-extension://test/inferenceWorker.js");
  const instance = FakeWorker.instances.at(-1);

  if (instance === undefined) {
    throw new Error("Channel did not construct a worker");
  }

  worker = instance;
  return channel;
};

describe("createInferenceWorker", () => {
  it("loads the worker as a module from the url it is given", () => {
    createChannel();

    expect(worker.url).toBe("moz-extension://test/inferenceWorker.js");
    expect(worker.options?.type).toBe("module");
  });

  it("resolves a request with its correlated response", async () => {
    const channel = createChannel();

    const pending = channel.request("worker.ping", {});
    worker.deliver(respondTo(worker.idOf(0), pong));

    await expect(pending).resolves.toMatchObject({ type: "worker.pong", payload: pong });
  });

  it("routes out-of-order responses to the right callers", async () => {
    const channel = createChannel();

    const first = channel.request("worker.ping", {});
    const second = channel.request("worker.ping", {});

    // Answered in reverse, which the protocol permits.
    worker.deliver(respondTo(worker.idOf(1), { ...pong, crossOriginIsolated: true }));
    worker.deliver(respondTo(worker.idOf(0), pong));

    await expect(second).resolves.toMatchObject({ payload: { crossOriginIsolated: true } });
    await expect(first).resolves.toMatchObject({ payload: { crossOriginIsolated: false } });
  });

  it("rejects with the reason when the worker reports a failure", async () => {
    const channel = createChannel();

    const pending = channel.request("worker.ping", {});
    worker.deliver({
      ...buildRpcMessage("worker.error", { requestType: "worker.ping", reason: "no adapter" }),
      id: worker.idOf(0),
    });

    await expect(pending).rejects.toThrow(/no adapter/);
  });

  it("fails every outstanding request when the worker crashes", async () => {
    const channel = createChannel();

    const first = channel.request("worker.ping", {});
    const second = channel.request("worker.ping", {});

    worker.crash("out of memory");

    await expect(first).rejects.toThrow(/out of memory/);
    await expect(second).rejects.toThrow(/out of memory/);
  });

  it("ignores a malformed message rather than failing unrelated requests", async () => {
    const channel = createChannel();

    const pending = channel.request("worker.ping", {});

    worker.deliver({ nonsense: true });
    worker.deliver(respondTo(worker.idOf(0), pong));

    await expect(pending).resolves.toMatchObject({ type: "worker.pong" });
  });

  it("ignores a response whose id matches nothing outstanding", () => {
    createChannel();

    expect(() => worker.deliver(respondTo("not-a-pending-id", pong))).not.toThrow();
  });

  it("rejects a request the worker never answers", async () => {
    vi.useFakeTimers();
    const channel = createChannel();

    const pending = channel.request("worker.ping", {});
    const assertion = expect(pending).rejects.toThrow(/in time/);

    await vi.advanceTimersByTimeAsync(INFERENCE_REQUEST_TIMEOUT_MS);

    await assertion;
  });

  it("does not time out a request that was answered", async () => {
    vi.useFakeTimers();
    const channel = createChannel();

    const pending = channel.request("worker.ping", {});
    worker.deliver(respondTo(worker.idOf(0), pong));

    await expect(pending).resolves.toMatchObject({ type: "worker.pong" });

    // Advancing past the deadline must not produce an unhandled rejection.
    await vi.advanceTimersByTimeAsync(INFERENCE_REQUEST_TIMEOUT_MS * 2);
  });

  it("terminates the worker and fails what was still pending", async () => {
    const channel = createChannel();

    const pending = channel.request("worker.ping", {});
    channel.terminate();

    await expect(pending).rejects.toThrow(/terminated/);
    expect(worker.terminated).toBe(true);
  });
});

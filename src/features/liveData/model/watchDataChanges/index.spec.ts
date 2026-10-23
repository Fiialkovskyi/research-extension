import { afterEach, describe, expect, it, vi } from "vitest";

import { watchDataChanges, type WatchablePort } from ".";
import { DATA_TOPICS } from "../../constants";
import { buildRpcMessage } from "@/shared/rpc";

const createPort = () => {
  const messageListeners: ((message: unknown) => void)[] = [];
  const disconnectListeners: (() => void)[] = [];
  const sent: unknown[] = [];
  const port: WatchablePort = {
    postMessage: (message) => {
      sent.push(message);
    },
    onMessage: { addListener: (listener) => messageListeners.push(listener) },
    onDisconnect: { addListener: (listener) => disconnectListeners.push(listener) },
    disconnect: vi.fn(),
  };

  return {
    port,
    sent,
    receive: (message: unknown) => {
      messageListeners.forEach((listener) => {
        listener(message);
      });
    },
    drop: () => {
      disconnectListeners.forEach((listener) => {
        listener();
      });
    },
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("watchDataChanges", () => {
  it("subscribes on connecting and reports the topics the background names", () => {
    const first = createPort();
    const onChange = vi.fn();

    watchDataChanges({ connect: () => first.port, onChange });
    first.receive(buildRpcMessage("data.changed", { topics: ["facts", "clusters"] }));

    expect(first.sent).toEqual([expect.objectContaining({ type: "data.subscribe" })]);
    expect(onChange).toHaveBeenCalledWith(["facts", "clusters"]);
  });

  it("ignores messages that are not notifications", () => {
    const first = createPort();
    const onChange = vi.fn();

    watchDataChanges({ connect: () => first.port, onChange });
    first.receive({ nonsense: true });
    first.receive(buildRpcMessage("graph.snapshot", {}));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("connects again when the port drops, and says anything may have changed", () => {
    vi.useFakeTimers();

    const first = createPort();
    const second = createPort();
    const connect = vi.fn().mockReturnValueOnce(first.port).mockReturnValueOnce(second.port);
    const onChange = vi.fn();

    watchDataChanges({ connect, onChange, reconnectDelayMs: 500 });
    first.drop();
    vi.advanceTimersByTime(500);

    expect(connect).toHaveBeenCalledTimes(2);
    expect(second.sent).toEqual([expect.objectContaining({ type: "data.subscribe" })]);
    expect(onChange).toHaveBeenCalledWith(DATA_TOPICS);
  });

  it("stops following when asked, and does not reconnect afterwards", () => {
    vi.useFakeTimers();

    const first = createPort();
    const connect = vi.fn(() => first.port);
    const stop = watchDataChanges({ connect, onChange: vi.fn() });

    stop();
    first.drop();
    vi.advanceTimersByTime(5_000);

    expect(first.port.disconnect).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledOnce();
  });
});

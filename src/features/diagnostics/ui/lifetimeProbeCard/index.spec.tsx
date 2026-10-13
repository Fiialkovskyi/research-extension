import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LifetimeProbeCard, type LifetimeProbeCardClient } from ".";
import { buildRpcMessage } from "@/shared/rpc";

type Listener = (message: unknown) => void;

const createStubClient = () => {
  const listeners = new Set<Listener>();
  const sent: { type: string; payload: unknown }[] = [];
  const client: LifetimeProbeCardClient = {
    send: (message) => {
      sent.push(message as { type: string; payload: unknown });
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
  const push = (message: unknown) => {
    act(() => {
      for (const listener of Array.from(listeners)) {
        listener(message);
      }
    });
  };

  return { client, sent, push };
};

/** A run as the background reads it. */
const run = (state: string, overrides: Record<string, unknown> = {}) => ({
  runId: `run-${state}`,
  strategy: "apiActivity",
  holdMs: 120_000,
  startedAt: 0,
  state,
  lastSeenMs: 120_000,
  longestGapMs: 2_000,
  pageLoads: 1,
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LifetimeProbeCard", () => {
  it("reads the recorded runs when it opens, so outcomes survive closing the page", () => {
    const { client, sent } = createStubClient();

    render(<LifetimeProbeCard client={client} />);

    expect(sent).toEqual([expect.objectContaining({ type: "diagnostics.readProbes" })]);
    expect(screen.getByTestId("lifetime-probe").dataset.read).toBe("false");
    expect(screen.getByTestId("probe-none")).toBeTruthy();
  });

  it("starts a run with the chosen strategy and hold, then reads the runs again", () => {
    const { client, sent, push } = createStubClient();

    render(<LifetimeProbeCard client={client} />);
    fireEvent.change(screen.getByTestId("probe-strategy"), { target: { value: "hostPage" } });
    fireEvent.change(screen.getByTestId("probe-hold"), { target: { value: "90" } });
    fireEvent.click(screen.getByTestId("probe-start"));

    expect(sent.at(-1)).toMatchObject({
      type: "diagnostics.lifetimeProbe",
      payload: { strategy: "hostPage", holdMs: 90_000 },
    });

    push(buildRpcMessage("diagnostics.probeStarted", { runId: "run-1" }));

    expect(sent.at(-1)).toMatchObject({ type: "diagnostics.readProbes" });
  });

  it("shows each outcome with its own state", () => {
    const { client, push } = createStubClient();

    render(<LifetimeProbeCard client={client} />);
    push(
      buildRpcMessage("diagnostics.probes", {
        runs: [
          run("completed"),
          run("resumed", { strategy: "wakeAndResume", pageLoads: 2, longestGapMs: 61_000 }),
          run("stopped", { strategy: "none", lastSeenMs: 30_000 }),
          run("stopped", { runId: "run-woken", strategy: "wakeAndResume", pageLoads: 3 }),
          run("running", { lastSeenMs: 4_000 }),
        ],
      }),
    );

    const lines = screen.getAllByTestId("probe-run");

    expect(screen.getByTestId("lifetime-probe").dataset.read).toBe("true");

    expect(lines.map((line) => line.dataset.state)).toEqual([
      "completed",
      "resumed",
      "stopped",
      "stopped",
      "running",
    ]);
    expect(lines[0]?.textContent).toContain("held 120 s without an unload");
    expect(lines[1]?.textContent).toContain("after 1 unload(s), longest gap 61 s");
    expect(lines[2]?.textContent).toContain("unloaded at 30 s of 120 s");
    expect(lines[3]?.textContent).toContain("(resumed 2 time(s) so far)");
    expect(lines[4]?.textContent).toContain("running, 4 s of 120 s");
  });

  it("reads the runs again while one is running, and stops once none is", () => {
    vi.useFakeTimers();

    const { client, sent, push } = createStubClient();

    render(<LifetimeProbeCard client={client} refreshIntervalMs={1_000} />);
    push(buildRpcMessage("diagnostics.probes", { runs: [run("running")] }));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    const reads = () => sent.filter(({ type }) => type === "diagnostics.readProbes").length;

    expect(reads()).toBe(3);

    push(buildRpcMessage("diagnostics.probes", { runs: [run("completed")] }));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(reads()).toBe(3);
  });

  it("keeps reading after a start until the new run is listed", () => {
    vi.useFakeTimers();

    const { client, sent, push } = createStubClient();
    const reads = () => sent.filter(({ type }) => type === "diagnostics.readProbes").length;

    render(<LifetimeProbeCard client={client} refreshIntervalMs={1_000} />);
    push(buildRpcMessage("diagnostics.probes", { runs: [] }));
    push(buildRpcMessage("diagnostics.probeStarted", { runId: "run-running" }));
    push(buildRpcMessage("diagnostics.probes", { runs: [] }));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(reads()).toBe(4);

    push(
      buildRpcMessage("diagnostics.probes", { runs: [run("completed", { runId: "run-running" })] }),
    );
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(reads()).toBe(4);
  });

  it("shows why a start was refused", () => {
    const { client, push } = createStubClient();

    render(<LifetimeProbeCard client={client} />);
    fireEvent.click(screen.getByTestId("probe-start"));
    push(
      buildRpcMessage("rpc.refused", {
        rejection: "invalid-payload",
        reason: "holdMs is out of range",
      }),
    );

    expect(screen.getByTestId("probe-problem").textContent).toContain("out of range");
  });
});

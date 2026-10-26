import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityStrip } from ".";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const text = () => screen.getByTestId("activity-text").textContent;

describe("ActivityStrip", () => {
  it("names the work and fills the bar by the batch's progress", () => {
    render(
      <ActivityStrip
        state={{ kind: "working", label: "Extracting facts", settled: 3, total: 12, failed: 0 }}
        onOpenSetup={vi.fn()}
      />,
    );

    expect(text()).toBe("Extracting facts · 3 of 12");

    const bar = screen.getByTestId("activity-bar");

    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuemax")).toBe("12");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("25%");
  });

  it("shows a lone job alive: a bar with no value and a ticking timer", () => {
    vi.useFakeTimers();

    let clock = 140_000;

    render(
      <ActivityStrip
        state={{
          kind: "working",
          label: "Summarizing topics",
          settled: 0,
          total: 1,
          startedAt: 100_000,
          failed: 0,
        }}
        onOpenSetup={vi.fn()}
        getNow={() => clock}
      />,
    );

    expect(text()).toBe("Summarizing topics · 40s");
    expect(screen.getByTestId("activity-bar").hasAttribute("aria-valuenow")).toBe(false);

    act(() => {
      clock = 141_000;
      vi.advanceTimersByTime(1_000);
    });

    expect(text()).toBe("Summarizing topics · 41s");
  });

  it("says generation waits until the user steps away", () => {
    render(
      <ActivityStrip state={{ kind: "waiting", waiting: 4, failed: 0 }} onOpenSetup={vi.fn()} />,
    );

    expect(text()).toBe("Runs when you step away · 4 waiting");
    expect(screen.queryByTestId("activity-bar")).toBeNull();
  });

  it("says the local AI is not answering and leads to setup", () => {
    const onOpenSetup = vi.fn();

    render(
      <ActivityStrip state={{ kind: "paused", waiting: 5, failed: 0 }} onOpenSetup={onOpenSetup} />,
    );

    expect(text()).toBe("Local AI isn't answering · 5 waiting");
    fireEvent.click(screen.getByTestId("activity-open-setup"));
    expect(onOpenSetup).toHaveBeenCalledOnce();
  });

  it("reports what AI has done when everything is processed", () => {
    render(
      <ActivityStrip
        state={{ kind: "ready", totals: { pagesRead: 14, factsFrom: 12, summaries: 3 }, failed: 0 }}
        onOpenSetup={vi.fn()}
      />,
    );

    expect(text()).toBe("AI ready · everything processed");
    expect(screen.getByTestId("activity-totals").textContent).toBe(
      "14 pages read · facts from 12 · 3 summaries",
    );
  });

  it("shows no totals line when nothing was done yet", () => {
    render(
      <ActivityStrip state={{ kind: "ready", totals: {}, failed: 0 }} onOpenSetup={vi.fn()} />,
    );

    expect(screen.queryByTestId("activity-totals")).toBeNull();
  });

  it.each([
    { kind: "working", label: "Reading pages", settled: 1, total: 3, failed: 2 },
    { kind: "waiting", waiting: 1, failed: 2 },
    { kind: "paused", waiting: 1, failed: 2 },
    { kind: "ready", totals: {}, failed: 2 },
  ] as const)("counts failures in the $kind state", (state) => {
    render(<ActivityStrip state={state} onOpenSetup={vi.fn()} />);

    expect(screen.getByTestId("activity-failed").textContent).toContain("2 didn't finish");
  });

  it("shows no failures when there are none", () => {
    render(
      <ActivityStrip state={{ kind: "ready", totals: {}, failed: 0 }} onOpenSetup={vi.fn()} />,
    );

    expect(screen.queryByTestId("activity-failed")).toBeNull();
  });
});

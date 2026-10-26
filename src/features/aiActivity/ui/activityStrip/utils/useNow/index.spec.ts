import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useNow } from ".";

afterEach(() => {
  vi.useRealTimers();
});

describe("useNow", () => {
  it("re-reads the clock every second while ticking", () => {
    vi.useFakeTimers();

    let clock = 1_000;
    const getNow = () => clock;
    const { result } = renderHook(() => useNow(true, getNow));

    expect(result.current).toBe(1_000);

    act(() => {
      clock = 2_000;
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current).toBe(2_000);
  });

  it("leaves the clock alone while not ticking", () => {
    vi.useFakeTimers();

    let clock = 1_000;
    const getNow = () => clock;
    const { result } = renderHook(() => useNow(false, getNow));

    act(() => {
      clock = 5_000;
      vi.advanceTimersByTime(3_000);
    });

    expect(result.current).toBe(1_000);
  });
});

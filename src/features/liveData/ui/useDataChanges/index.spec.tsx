import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDataChanges, type WatchData } from ".";

const TOPICS = ["facts"] as const;

const createWatch = () => {
  let listener: Parameters<WatchData>[0] | undefined;
  const watch: WatchData = (onChange) => {
    listener = onChange;

    return () => {
      listener = undefined;
    };
  };

  return {
    watch,
    emit: async (topics: Parameters<Parameters<WatchData>[0]>[0]) => {
      await act(async () => {
        listener?.(topics);
        await Promise.resolve();
      });
    },
    isWatching: () => listener !== undefined,
  };
};

describe("useDataChanges", () => {
  it("reloads when a topic the page shows changed, and not for another", async () => {
    const { watch, emit } = createWatch();
    const reload = vi.fn(() => Promise.resolve());

    renderHook(() => {
      useDataChanges(watch, TOPICS, reload);
    });
    await emit(["models"]);
    await emit(["facts", "models"]);

    expect(reload).toHaveBeenCalledOnce();
  });

  it("reloads once more, not alongside, when a change arrives during a reload", async () => {
    const { watch, emit } = createWatch();
    const releases: (() => void)[] = [];
    let running = 0;
    let peak = 0;
    const reload = vi.fn(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise<void>((resolve) => {
        releases.push(resolve);
      });
      running -= 1;
    });

    renderHook(() => {
      useDataChanges(watch, TOPICS, reload);
    });
    await emit(["facts"]);
    await emit(["facts"]);
    await act(async () => {
      releases.shift()?.();
      await Promise.resolve();
    });
    await act(async () => {
      releases.shift()?.();
      await Promise.resolve();
    });

    expect(reload).toHaveBeenCalledTimes(2);
    expect(peak).toBe(1);
  });

  it("stops listening when the page goes away", () => {
    const { watch, isWatching } = createWatch();
    const { unmount } = renderHook(() => {
      useDataChanges(watch, TOPICS, vi.fn());
    });

    expect(isWatching()).toBe(true);
    unmount();
    expect(isWatching()).toBe(false);
  });

  it("does nothing on a page with no port", () => {
    expect(() =>
      renderHook(() => {
        useDataChanges(undefined, TOPICS, vi.fn());
      }),
    ).not.toThrow();
  });
});

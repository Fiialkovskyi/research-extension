import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { holdBackgroundAlive } from ".";
import { KEEP_ALIVE_INTERVAL_MS } from "../../constants";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("holdBackgroundAlive", () => {
  it("touches the browser once per interval while held", () => {
    const touch = vi.fn(() => Promise.resolve());

    holdBackgroundAlive(touch);

    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS - 1);
    expect(touch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(touch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS * 2);
    expect(touch).toHaveBeenCalledTimes(3);
  });

  it("touches at the interval it is given", () => {
    const touch = vi.fn(() => Promise.resolve());

    holdBackgroundAlive(touch, 2_000);
    vi.advanceTimersByTime(6_000);

    expect(touch).toHaveBeenCalledTimes(3);
  });

  it("stops touching once released, and a second release does nothing", () => {
    const touch = vi.fn(() => Promise.resolve());
    const release = holdBackgroundAlive(touch);

    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
    release();
    release();
    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS * 5);

    expect(touch).toHaveBeenCalledTimes(1);
  });

  it("is released by a finally when the held work throws", async () => {
    const touch = vi.fn(() => Promise.resolve());
    const work = async () => {
      const release = holdBackgroundAlive(touch);

      try {
        throw new Error("job failed");
      } finally {
        release();
      }
    };

    await expect(work()).rejects.toThrow("job failed");
    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS * 3);

    expect(touch).not.toHaveBeenCalled();
  });

  it("keeps touching after a touch fails", async () => {
    const touch = vi.fn(() => Promise.reject(new Error("no such API")));

    holdBackgroundAlive(touch);
    await vi.advanceTimersByTimeAsync(KEEP_ALIVE_INTERVAL_MS * 2);

    expect(touch).toHaveBeenCalledTimes(2);
  });
});

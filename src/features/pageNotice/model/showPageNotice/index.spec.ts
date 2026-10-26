import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { showPageNotice } from ".";

const HOST = "research-graph-notice";

const show = (sessionTitle = "E-bike motors", isReducedMotion = false) =>
  showPageNotice({
    document,
    sessionTitle,
    isDark: false,
    isReducedMotion,
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs) as unknown as number,
    clearTimer: (handle) => {
      window.clearTimeout(handle);
    },
  });

const hosts = () => document.querySelectorAll(HOST);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("showPageNotice", () => {
  it("shows one notice in the top-right corner", () => {
    show();

    const [host] = Array.from(hosts()) as HTMLElement[];

    expect(hosts()).toHaveLength(1);
    expect(host?.style.position).toBe("fixed");
    expect(host?.style.top).toBe("16px");
    expect(host?.style.right).toBe("16px");
  });

  it("takes no pointer events, so a click under it reaches the page", () => {
    show();

    expect((hosts()[0] as HTMLElement).style.pointerEvents).toBe("none");
  });

  it("keeps its content out of the page's reach", () => {
    show("Secret title");

    const host = hosts()[0] as HTMLElement;

    expect(host.shadowRoot).toBeNull();
    expect(document.body.textContent).not.toContain("Secret title");
    expect(document.documentElement.innerHTML).not.toContain("Secret title");
  });

  it("fades in, then out, and is removed after a few seconds", () => {
    show();
    const host = hosts()[0] as HTMLElement;

    expect(host.style.opacity).toBe("0");

    vi.advanceTimersByTime(60);

    expect(host.style.opacity).toBe("1");

    vi.advanceTimersByTime(3_500);

    expect(host.style.opacity).toBe("0");

    vi.advanceTimersByTime(250);

    expect(hosts()).toHaveLength(0);
  });

  it("replaces a notice that is still showing", () => {
    show("First");
    vi.advanceTimersByTime(1_000);
    show("Second");

    expect(hosts()).toHaveLength(1);

    // The first one's timers are gone: it must not remove the newer notice.
    vi.advanceTimersByTime(3_000);

    expect(hosts()).toHaveLength(1);
  });

  it("appears and goes without a fade when the user prefers reduced motion", () => {
    show("E-bike motors", true);
    const host = hosts()[0] as HTMLElement;

    expect(host.style.opacity).toBe("1");
    expect(host.style.transition).toBe("none");

    vi.advanceTimersByTime(3_500);

    expect(hosts()).toHaveLength(0);
  });
});

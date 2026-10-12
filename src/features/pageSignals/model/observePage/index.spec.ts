import { beforeEach, describe, expect, it, vi } from "vitest";

import { observePage, type PageObserverDependencies } from ".";
import { buildRpcMessage } from "@/shared/rpc";

type Listener = (event: { isTrusted: boolean }) => void;

/** An event target that remembers its listeners, so a test can fire them as the user would. */
const buildTarget = () => {
  const listeners = new Map<string, Set<Listener>>();

  return {
    listeners,
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
    },
    removeEventListener: (type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener);
    },
    fire: (type: string, isTrusted = true) => {
      for (const listener of listeners.get(type) ?? []) {
        listener({ isTrusted });
      }
    },
    countListeners: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
  };
};

/** A page 4000 px tall in an 800 px viewport, scrolled to the top. */
const buildPage = () => {
  const window = Object.assign(buildTarget(), { scrollY: 0, innerHeight: 800 });
  const document = Object.assign(buildTarget(), {
    visibilityState: "visible",
    documentElement: { scrollHeight: 4000 },
  });

  return { window, document };
};

let page: ReturnType<typeof buildPage>;
let frames: (() => void)[];
let timers: Map<number, () => void>;
let nextTimer: number;
let sent: { type: string; payload: unknown }[];
let answer: unknown;
let isExtensionGone: boolean;
let requestListener: ((message: unknown) => Promise<unknown> | undefined) | undefined;
let extract: ReturnType<typeof vi.fn<PageObserverDependencies["extract"]>>;

const observe = () =>
  observePage({
    window: page.window as unknown as Window,
    document: page.document as unknown as Document,
    send: (message) => {
      sent.push(message as { type: string; payload: unknown });
      return isExtensionGone
        ? Promise.reject(new Error("Extension context invalidated."))
        : Promise.resolve(answer);
    },
    onRequest: (listener) => {
      requestListener = listener;
      return () => {
        requestListener = undefined;
      };
    },
    requestFrame: (callback) => {
      frames.push(callback);
    },
    setTimer: (callback) => {
      nextTimer += 1;
      timers.set(nextTimer, callback);
      return nextTimer;
    },
    clearTimer: (handle) => {
      timers.delete(handle);
    },
    extract,
  });

/** Paints a frame: runs every callback asked for before it. */
const paint = () => {
  const due = frames;

  frames = [];
  due.forEach((callback) => {
    callback();
  });
};

/** Lets 2 s pass: fires every pending timer. */
const elapse = () => {
  const due = [...timers.values()];

  timers.clear();
  due.forEach((callback) => {
    callback();
  });
};

const scrollTo = (scrollY: number) => {
  page.window.scrollY = scrollY;
  page.window.fire("scroll");
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  page = buildPage();
  frames = [];
  timers = new Map();
  nextTimer = 0;
  sent = [];
  answer = buildRpcMessage("signal.recorded", {});
  isExtensionGone = false;
  requestListener = undefined;
  extract = vi.fn<PageObserverDependencies["extract"]>(() => ({
    text: "Article",
    truncated: false,
  }));
});

describe("observePage", () => {
  it("measures the part of the page in view before any scrolling", () => {
    observe();
    paint();
    elapse();

    expect(sent).toEqual([
      expect.objectContaining({ type: "signal.batch", payload: { maxScroll: 0.2, copyEvents: 0 } }),
    ]);
  });

  it("measures a burst of scroll events once per frame, never in the listener", () => {
    observe();
    paint();

    const frameCount = frames.length;

    scrollTo(100);
    scrollTo(200);
    scrollTo(300);

    expect(frames).toHaveLength(frameCount + 1);
  });

  it("sends the deepest point reached, not where the page is now", () => {
    observe();
    paint();
    scrollTo(2400);
    paint();
    scrollTo(0);
    paint();
    elapse();

    expect(sent.at(-1)?.payload).toEqual({ maxScroll: 0.8, copyEvents: 0 });
  });

  it("sends at most one batch per 2 s of continuous scrolling", () => {
    observe();

    for (let step = 1; step <= 20; step += 1) {
      scrollTo(step * 100);
      paint();
    }

    expect(sent).toHaveLength(0);

    elapse();

    expect(sent).toHaveLength(1);
  });

  it("sends at once when the page is hidden or left", () => {
    observe();
    paint();
    page.document.visibilityState = "hidden";
    page.document.fire("visibilitychange");

    expect(sent).toHaveLength(1);

    scrollTo(1000);
    paint();
    page.window.fire("pagehide");

    expect(sent).toHaveLength(2);
    expect(timers.size).toBe(0);
  });

  it("sends nothing when nothing new was seen", () => {
    observe();
    paint();
    elapse();
    scrollTo(0);
    paint();
    elapse();
    page.window.fire("pagehide");

    expect(sent).toHaveLength(1);
  });

  it("counts copies the user made, and only those", () => {
    observe();
    paint();
    elapse();
    page.window.fire("copy");
    page.window.fire("copy");
    page.window.fire("copy", false);
    elapse();

    expect(sent.at(-1)?.payload).toEqual({ maxScroll: 0.2, copyEvents: 2 });
  });

  it("sends copies since the last batch, not a running total", () => {
    observe();
    page.window.fire("copy");
    elapse();
    page.window.fire("copy");
    elapse();

    expect(sent.map((message) => (message.payload as { copyEvents: number }).copyEvents)).toEqual([
      1, 1,
    ]);
  });

  it("stops observing when the background says the tab left the session", async () => {
    answer = buildRpcMessage("signal.dropped", { stop: true });
    observe();
    paint();
    elapse();
    await settle();

    expect(page.window.countListeners() + page.document.countListeners()).toBe(0);
    expect(requestListener).toBeUndefined();

    scrollTo(3000);
    page.window.fire("copy");

    expect(frames).toHaveLength(0);
    expect(timers.size).toBe(0);
  });

  it("keeps observing when only this batch was not recorded", async () => {
    answer = buildRpcMessage("signal.dropped", { stop: false });
    observe();
    paint();
    elapse();
    await settle();

    expect(page.window.countListeners()).toBeGreaterThan(0);
  });

  it("stops observing once the extension is gone", async () => {
    isExtensionGone = true;
    observe();
    paint();
    elapse();
    await settle();

    expect(page.window.countListeners() + page.document.countListeners()).toBe(0);
  });

  it("sends the page's text once, however often it is asked", async () => {
    observe();

    await requestListener?.(buildRpcMessage("content.extract", {}));
    await requestListener?.(buildRpcMessage("content.extract", {}));

    expect(extract).toHaveBeenCalledTimes(1);
    expect(sent.filter((message) => message.type === "content.extracted")).toEqual([
      expect.objectContaining({
        payload: { text: "Article", truncated: false, extractorVersion: "readability@0.6.0/1" },
      }),
    ]);
  });

  it("sends nothing when the page has no readable text, and does not try again", async () => {
    extract.mockReturnValue(undefined);
    observe();

    await requestListener?.(buildRpcMessage("content.extract", {}));
    await requestListener?.(buildRpcMessage("content.extract", {}));

    expect(extract).toHaveBeenCalledTimes(1);
    expect(sent.filter((message) => message.type === "content.extracted")).toEqual([]);
  });

  it("sends what it holds when asked to flush, and answers once it is sent", async () => {
    observe();
    paint();
    scrollTo(2400);
    paint();

    const flushed = await requestListener?.(buildRpcMessage("content.flush", {}));

    expect(sent.at(-1)).toMatchObject({ type: "signal.batch", payload: { maxScroll: 0.8 } });
    expect(flushed).toMatchObject({ type: "content.flushed" });
    expect(timers.size).toBe(0);
  });

  it("answers a flush at once when it holds nothing new", async () => {
    observe();
    paint();
    elapse();

    const count = sent.length;

    expect(await requestListener?.(buildRpcMessage("content.flush", {}))).toMatchObject({
      type: "content.flushed",
    });
    expect(sent).toHaveLength(count);
  });

  it("leaves messages meant for something else unanswered", () => {
    observe();

    expect(requestListener?.(buildRpcMessage("graph.snapshot", {}))).toBeUndefined();
    expect(requestListener?.("not a message")).toBeUndefined();
  });

  it("observes a page once, however often it is injected", () => {
    observe();
    observe();

    expect(page.window.listeners.get("scroll")?.size).toBe(1);
    expect(page.window.listeners.get("copy")?.size).toBe(1);
  });
});

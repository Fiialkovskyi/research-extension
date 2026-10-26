import { describe, expect, it, vi } from "vitest";

import { buildRpcMessage } from "@/shared/rpc";

import { listenForBlockedNotice } from ".";

const setUp = () => {
  let listener: ((message: unknown) => Promise<unknown> | undefined) | undefined;
  const stop = vi.fn();
  const showNotice = vi.fn();
  const stopListening = listenForBlockedNotice({
    onRequest: (candidate) => {
      listener = candidate;

      return stop;
    },
    showNotice,
  });

  return { ask: (message: unknown) => listener?.(message), showNotice, stop, stopListening };
};

describe("listenForBlockedNotice", () => {
  it("shows the notice for a blocked-site request, naming the session, and answers it", async () => {
    const { ask, showNotice } = setUp();

    const answer = await ask(
      buildRpcMessage("pageNotice.show", { sessionTitle: "E-bikes", kind: "blocked" }),
    );

    expect(showNotice).toHaveBeenCalledWith("E-bikes");
    expect(answer).toMatchObject({ type: "pageNotice.shown" });
  });

  it.each([
    buildRpcMessage("pageNotice.show", { sessionTitle: "E-bikes" }),
    buildRpcMessage("pageNotice.show", { sessionTitle: "E-bikes", kind: "added" }),
    buildRpcMessage("content.extract", {}),
    buildRpcMessage("content.flush", {}),
    { not: "a message" },
    "text",
  ])("ignores everything else: %j", (message) => {
    const { ask, showNotice } = setUp();

    expect(ask(message)).toBeUndefined();
    expect(showNotice).not.toHaveBeenCalled();
  });

  it("sends nothing of its own and can be stopped", () => {
    const { stopListening, stop } = setUp();

    stopListening();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});

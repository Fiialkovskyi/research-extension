import { describe, expect, it, vi } from "vitest";

import { readOllamaStatus } from ".";

const ORIGIN = "http://127.0.0.1:11434";
const MODEL = { name: "nomic-embed-text:latest", digest: "a".repeat(64), size: 274_000_000 };

const answer = (body: unknown, status = 200) =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

describe("readOllamaStatus", () => {
  it("lists the models of a running server", async () => {
    const fetchResource = answer({ models: [MODEL] });

    expect(await readOllamaStatus(fetchResource, ORIGIN)).toEqual({
      state: "running",
      models: [MODEL],
    });
    expect(fetchResource).toHaveBeenCalledWith(`${ORIGIN}/api/tags`, expect.any(Object));
    expect(fetchResource).toHaveBeenCalledWith(
      `${ORIGIN}/api/show`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls a server that does not answer unreachable", async () => {
    const fetchResource = vi.fn(() => Promise.reject(new TypeError("NetworkError")));

    expect(await readOllamaStatus(fetchResource, ORIGIN)).toEqual({ state: "unreachable" });
  });

  it("tells a refusal of this extension's origin apart", async () => {
    expect(await readOllamaStatus(answer({}, 403), ORIGIN)).toEqual({ state: "refused" });
  });

  it("calls a server refused when it lists models but refuses this extension's POST", async () => {
    // As Firefox behaves: no Origin on GET, so only the POST meets the policy.
    const fetchResource = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith("/api/tags")
          ? new Response(JSON.stringify({ models: [MODEL] }))
          : new Response("", { status: 403 }),
      ),
    );

    expect(await readOllamaStatus(fetchResource, ORIGIN)).toEqual({ state: "refused" });
  });

  it("calls an answer it cannot read unreachable rather than guessing", async () => {
    expect(await readOllamaStatus(answer({ unexpected: true }), ORIGIN)).toEqual({
      state: "unreachable",
    });
    expect(await readOllamaStatus(answer({}, 500), ORIGIN)).toEqual({ state: "unreachable" });
  });
});

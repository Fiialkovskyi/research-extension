import { describe, expect, it, vi } from "vitest";

import { readRepositoryJson } from ".";
import type { ModelReference } from "@/shared/modelManifest";

const reference: ModelReference = {
  hub: "huggingface",
  repository: "owner/model",
  revision: "a".repeat(40),
};

const createStubFetch = (response: Partial<Response>) =>
  vi.fn(() => Promise.resolve(response as Response)) as unknown as typeof fetch;

describe("readRepositoryJson", () => {
  it("returns the parsed document", async () => {
    const fetchResource = createStubFetch({ ok: true, json: () => Promise.resolve({ a: 1 }) });

    await expect(readRepositoryJson(reference, "config.json", fetchResource)).resolves.toEqual({
      a: 1,
    });
  });

  it("asks for the file at the pinned revision, with no credentials", async () => {
    const fetchResource = createStubFetch({ ok: true, json: () => Promise.resolve({}) });

    await readRepositoryJson(reference, "config.json", fetchResource);

    const [url, init] = vi.mocked(fetchResource).mock.calls[0] ?? [];

    expect(String(url)).toContain(reference.revision);
    expect(String(url)).toContain("config.json");
    expect(init).toMatchObject({ credentials: "omit" });
  });

  it("names the file and the status when the hub refuses", async () => {
    const fetchResource = createStubFetch({ ok: false, status: 404 });

    await expect(readRepositoryJson(reference, "config.json", fetchResource)).rejects.toThrow(
      /Could not read "config\.json" from owner\/model: the hub answered 404\./,
    );
  });

  it("names the file when the body is not JSON", async () => {
    const fetchResource = createStubFetch({
      ok: true,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    });

    await expect(readRepositoryJson(reference, "config.json", fetchResource)).rejects.toThrow(
      /"config\.json" in owner\/model is not valid JSON\./,
    );
  });
});

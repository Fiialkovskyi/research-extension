import { describe, expect, it, vi } from "vitest";

import { resolveModelRevision } from ".";

const commit = "751bff37182d3f1213fa05d7196b954e230abad9";
const repository = "Xenova/all-MiniLM-L6-v2";

/** A fetch that answers once with the given body and status. */
const createStubFetch = (body: unknown, init: { ok?: boolean; status?: number } = {}) => {
  return vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
};

describe("resolveModelRevision", () => {
  it("resolves a branch name to the commit it points at", async () => {
    expect(
      await resolveModelRevision(
        repository,
        "main",
        createStubFetch({ sha: commit, gated: false }),
      ),
    ).toBe(commit);
  });

  it("returns a reference that is already a commit, without asking the hub", async () => {
    const fetchResource = createStubFetch({ sha: "0".repeat(40) });

    expect(await resolveModelRevision(repository, commit, fetchResource)).toBe(commit);
    expect(fetchResource).not.toHaveBeenCalled();
  });

  it("asks the hub's revision endpoint for the repository and reference", async () => {
    const fetchResource = createStubFetch({ sha: commit });

    await resolveModelRevision(repository, "main", fetchResource);

    expect(fetchResource).toHaveBeenCalledWith(
      `https://huggingface.co/api/models/${repository}/revision/main`,
      expect.anything(),
    );
  });

  it("sends no credentials, so a download carries no identity", async () => {
    const fetchResource = createStubFetch({ sha: commit });

    await resolveModelRevision(repository, "main", fetchResource);

    expect(fetchResource).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("reports the status when the hub refuses the request", async () => {
    const fetchResource = createStubFetch({}, { ok: false, status: 404 });

    await expect(resolveModelRevision(repository, "main", fetchResource)).rejects.toThrow(/404/);
  });

  it.each([
    ["a missing commit", {}],
    ["a branch name where a commit belongs", { sha: "main" }],
    ["a truncated commit", { sha: commit.slice(0, 7) }],
    ["a non-object answer", "main"],
  ])("refuses %s rather than recording it as an identity", async (_label, body) => {
    await expect(resolveModelRevision(repository, "main", createStubFetch(body))).rejects.toThrow(
      /commit identifier/,
    );
  });

  it.each([
    ["automatic gating", "auto"],
    ["manual gating", "manual"],
    ["a boolean flag", true],
  ])("refuses a repository under %s", async (_label, gated) => {
    await expect(
      resolveModelRevision(repository, "main", createStubFetch({ sha: commit, gated })),
    ).rejects.toThrow(/gated/);
  });

  it("accepts a repository the hub reports as not gated", async () => {
    expect(
      await resolveModelRevision(
        repository,
        "main",
        createStubFetch({ sha: commit, gated: false }),
      ),
    ).toBe(commit);
  });

  it("accepts a repository whose answer omits the gating field", async () => {
    expect(await resolveModelRevision(repository, "main", createStubFetch({ sha: commit }))).toBe(
      commit,
    );
  });

  it("refuses a reference that would address another endpoint", async () => {
    const fetchResource = createStubFetch({ sha: commit });

    await expect(resolveModelRevision(repository, "../../etc", fetchResource)).rejects.toThrow(
      /relative/,
    );
    expect(fetchResource).not.toHaveBeenCalled();
  });
});

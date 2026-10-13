import { describe, expect, it } from "vitest";

import { listOllamaModelEntries } from ".";
import type { StoredModel } from "@/shared/storage";

const DIGEST = "a".repeat(64);

const registered = (active: boolean) =>
  ({
    ref: `ollama:nomic-embed-text:latest@${DIGEST}`,
    manifest: {
      reference: { hub: "ollama", repository: "nomic-embed-text:latest", revision: DIGEST },
    },
    active,
  }) as StoredModel;

describe("listOllamaModelEntries", () => {
  it("lists Ollama's models with whether each is registered and active", () => {
    expect(
      listOllamaModelEntries(
        [
          { name: "nomic-embed-text:latest", digest: DIGEST, size: 274_000_000 },
          { name: "llama3.2:3b", digest: "b".repeat(64), size: 2_000_000_000 },
        ],
        [registered(true)],
      ),
    ).toEqual([
      {
        name: "nomic-embed-text:latest",
        family: "embedding",
        isPulled: true,
        isRecommended: true,
        size: "274 MB",
        registeredRef: `ollama:nomic-embed-text:latest@${DIGEST}`,
        isActive: true,
      },
      {
        name: "llama3.2:3b",
        family: "unknown",
        isPulled: true,
        isRecommended: false,
        size: "2.0 GB",
        registeredRef: null,
        isActive: false,
      },
    ]);
  });

  it("offers each recommended model Ollama lacks, to download", () => {
    expect(listOllamaModelEntries([], [])).toEqual([
      expect.objectContaining({ name: "nomic-embed-text", isPulled: false, size: "274 MB" }),
    ]);
  });

  it("does not take a re-pulled model for the registered one", () => {
    const [entry] = listOllamaModelEntries(
      [{ name: "nomic-embed-text:latest", digest: "c".repeat(64), size: 1 }],
      [registered(true)],
    );

    expect(entry).toMatchObject({ registeredRef: null, isActive: false });
  });
});

import * as v from "valibot";
import { describe, expect, it } from "vitest";

import {
  BGE_SMALL_EN_V1_5,
  BUNDLED_MODEL_PROFILES,
  DEFAULT_PROFILE_BY_FAMILY,
  MINILM_L6_V2,
} from ".";
import { commitRevisionSchema } from "../../modelManifest";

describe("bundled model profiles", () => {
  it("carries at least one profile, or a fresh installation has nothing to offer", () => {
    expect(BUNDLED_MODEL_PROFILES.length).toBeGreaterThan(0);
  });

  it.each([...BUNDLED_MODEL_PROFILES])(
    "pins $repository to a commit rather than a branch",
    (profile) => {
      // A branch would make what the add-on installed depend on when it ran.
      expect(v.safeParse(commitRevisionSchema, profile.revision).success).toBe(true);
    },
  );

  it.each([...BUNDLED_MODEL_PROFILES])("names an owner and a name for $repository", (profile) => {
    expect(profile.repository).toMatch(/^[^/\s]+\/[^/\s]+$/);
  });

  it.each([...BUNDLED_MODEL_PROFILES])("declares a license for $repository", (profile) => {
    expect(profile.license.length).toBeGreaterThan(0);
  });

  it.each([...BUNDLED_MODEL_PROFILES])(
    "lists weights and tokenizer files for $repository",
    (profile) => {
      expect(profile.files).toContain("config.json");
      expect(profile.files).toContain("tokenizer.json");
      expect(profile.files.some((path) => path.endsWith(".onnx"))).toBe(true);
    },
  );

  it.each([...BUNDLED_MODEL_PROFILES])("lists each file of $repository once", (profile) => {
    expect(new Set(profile.files).size).toBe(profile.files.length);
  });

  it("names each repository once, so two profiles cannot claim one model", () => {
    const repositories = BUNDLED_MODEL_PROFILES.map((profile) => profile.repository);

    expect(new Set(repositories).size).toBe(repositories.length);
  });

  it("offers a default for the embedding family", () => {
    expect(DEFAULT_PROFILE_BY_FAMILY.embedding).toBe(MINILM_L6_V2);
  });

  it("defaults to a profile that is actually bundled", () => {
    for (const profile of Object.values(DEFAULT_PROFILE_BY_FAMILY)) {
      expect(BUNDLED_MODEL_PROFILES).toContain(profile);
    }
  });
});

describe("the two embedding profiles together", () => {
  it("cover both an absent and a present query prefix", () => {
    // The pair exists so the prefix half of the embedding contract is
    // exercised at all: the default model declares none.
    expect(MINILM_L6_V2.contract).toMatchObject({ prefixes: { query: "", document: "" } });
    expect(BGE_SMALL_EN_V1_5.contract).toMatchObject({ prefixes: { document: "" } });
    expect(
      BGE_SMALL_EN_V1_5.contract.family === "embedding" &&
        BGE_SMALL_EN_V1_5.contract.prefixes.query.length,
    ).toBeGreaterThan(0);
  });

  it("cover more than one pooling strategy", () => {
    const poolings = BUNDLED_MODEL_PROFILES.map((profile) =>
      profile.contract.family === "embedding" ? profile.contract.pooling : undefined,
    );

    expect(new Set(poolings.filter(Boolean)).size).toBeGreaterThan(1);
  });
});

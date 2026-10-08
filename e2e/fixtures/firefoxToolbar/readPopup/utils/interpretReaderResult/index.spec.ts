import { describe, expect, it } from "vitest";

import { interpretReaderResult } from "./index";
import { ACTOR_ERROR_PREFIX } from "../../../constants";

describe("interpretReaderResult", () => {
  it("passes a snapshot through untouched", () => {
    expect(interpretReaderResult('{"greeting":"Hello World"}')).toBe('{"greeting":"Hello World"}');
  });

  it("reports 'not loaded yet' as null, which keeps the caller polling", () => {
    expect(interpretReaderResult(null)).toBeNull();
    expect(interpretReaderResult(undefined)).toBeNull();
  });

  it("raises the actor's own failure instead of swallowing it", () => {
    expect(() => interpretReaderResult(`${ACTOR_ERROR_PREFIX}TypeError: no such actor`)).toThrow(
      /Reading the popup failed: TypeError: no such actor/,
    );
  });

  it("does not mistake an ordinary result mentioning an error for a failure", () => {
    expect(interpretReaderResult('{"greeting":"ERROR in the page text"}')).toContain("ERROR");
  });
});

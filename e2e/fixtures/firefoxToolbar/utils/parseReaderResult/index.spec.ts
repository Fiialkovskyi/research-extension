import { describe, expect, it } from "vitest";

import { parseReaderResult } from "./index";
import { ACTOR_ERROR_PREFIX } from "../../constants";

describe("parseReaderResult", () => {
  it("passes a snapshot through untouched", () => {
    expect(parseReaderResult('{"greeting":"Hello World"}')).toBe('{"greeting":"Hello World"}');
  });

  it("reports 'not loaded yet' as null, which keeps the caller polling", () => {
    expect(parseReaderResult(null)).toBeUndefined();
    expect(parseReaderResult(undefined)).toBeUndefined();
  });

  it("raises the actor's own failure instead of swallowing it", () => {
    expect(() => parseReaderResult(`${ACTOR_ERROR_PREFIX}TypeError: no such actor`)).toThrow(
      /Reading the popup failed: TypeError: no such actor/,
    );
  });

  it("does not mistake an ordinary result mentioning an error for a failure", () => {
    expect(parseReaderResult('{"greeting":"ERROR in the page text"}')).toContain("ERROR");
  });
});

import { describe, expect, it } from "vitest";

import { collectPolicyViolations, type PolicyViolation } from ".";

/**
 * A stand-in for the context that reports violations.
 *
 * Tests here cover only what the collector itself decides — attaching,
 * accumulating and deduplicating. What counts as a reportable violation, and
 * how a blocked URI becomes an origin, are tested where those decisions live.
 */
const fakeTarget = () => {
  const listeners: ((event: PolicyViolation) => void)[] = [];

  return {
    target: {
      addEventListener: (_type: string, listener: (event: PolicyViolation) => void) => {
        listeners.push(listener);
      },
    },
    report: (blockedURI: string, violatedDirective = "connect-src") => {
      for (const listener of listeners) {
        listener({ blockedURI, violatedDirective });
      }
    },
  };
};

describe("collectPolicyViolations", () => {
  it("records nothing before anything is blocked", () => {
    const { target } = fakeTarget();

    expect(collectPolicyViolations(target).read()).toEqual([]);
  });

  it("records a blocked request once it is reported", () => {
    const { target, report } = fakeTarget();
    const log = collectPolicyViolations(target);

    report("https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.wasm");

    expect(log.read()).toEqual([{ origin: "https://cdn.jsdelivr.net", directive: "connect-src" }]);
  });

  it("collapses repeated blocks to one entry, since an install makes many requests", () => {
    const { target, report } = fakeTarget();
    const log = collectPolicyViolations(target);

    report("https://cdn.example.com/a");
    report("https://cdn.example.com/b");
    report("https://cdn.example.com/c");

    expect(log.read()).toHaveLength(1);
  });

  it("keeps the first report of a pair, not the last", () => {
    const { target, report } = fakeTarget();
    const log = collectPolicyViolations(target);

    report("https://cdn.example.com/first");
    report("https://cdn.example.com/second");

    expect(log.read()).toEqual([{ origin: "https://cdn.example.com", directive: "connect-src" }]);
  });

  it("keeps two origins apart", () => {
    const { target, report } = fakeTarget();
    const log = collectPolicyViolations(target);

    report("https://first.example.com/a");
    report("https://second.example.com/a");

    expect(log.read().map((entry) => entry.origin)).toEqual([
      "https://first.example.com",
      "https://second.example.com",
    ]);
  });

  it("keeps one origin refused by two directives apart", () => {
    const { target, report } = fakeTarget();
    const log = collectPolicyViolations(target);

    report("https://example.com/a", "connect-src");
    report("https://example.com/a.js", "script-src");

    expect(log.read()).toHaveLength(2);
  });

  it("ignores a report the collector is told is not worth recording", () => {
    const { target, report } = fakeTarget();
    const log = collectPolicyViolations(target);

    report("");

    expect(log.read()).toEqual([]);
  });

  it("reads the same log twice without consuming it", () => {
    const { target, report } = fakeTarget();
    const log = collectPolicyViolations(target);

    report("https://example.com/a");

    expect(log.read()).toHaveLength(1);
    expect(log.read()).toHaveLength(1);
  });

  it("reflects a report that arrives after an earlier read", () => {
    const { target, report } = fakeTarget();
    const log = collectPolicyViolations(target);

    expect(log.read()).toEqual([]);
    report("https://example.com/a");

    expect(log.read()).toHaveLength(1);
  });
});

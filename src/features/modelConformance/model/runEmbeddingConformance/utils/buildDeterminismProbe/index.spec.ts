import { describe, expect, it, vi } from "vitest";

import { buildDeterminismProbe } from ".";

const vector = (values: readonly number[]) => new Float32Array(values);

const anchors = ["first question", "second question"];

/** Answers each call in turn, so a diverging second call is expressible. */
const embedReturning = (...batches: Float32Array[][]) => {
  let call = 0;

  return vi.fn(() => Promise.resolve(batches[Math.min(call++, batches.length - 1)] ?? []));
};

describe("buildDeterminismProbe", () => {
  it("passes when the same text twice gives the same vector", async () => {
    const embed = embedReturning([vector([1, 0])], [vector([1, 0])]);

    expect((await buildDeterminismProbe(anchors, embed)).passed).toBe(true);
  });

  it("passes on a pair that is numerically all but identical", async () => {
    // Float arithmetic across runs is not bit-identical, which is why the bar
    // is a similarity threshold rather than equality.
    const embed = embedReturning([vector([1, 0])], [vector([0.9999999, 0.0001])]);

    expect((await buildDeterminismProbe(anchors, embed)).passed).toBe(true);
  });

  it("fails when the second vector points somewhere else", async () => {
    const embed = embedReturning([vector([1, 0])], [vector([0, 1])]);

    const probe = await buildDeterminismProbe(anchors, embed);

    expect(probe.passed).toBe(false);
    expect(probe.detail).toMatch(/similarity of/);
  });

  it("fails on a drift that looks small but is outside the bar", async () => {
    // The real runtime produced 0.9945 when the two embeddings came from
    // batches of different widths. That is the kind of difference this probe
    // exists to catch — and the reason both of its calls use one batch shape.
    const embed = embedReturning([vector([1, 0.1])], [vector([1, 0.21])]);

    expect((await buildDeterminismProbe(anchors, embed)).passed).toBe(false);
  });

  it("embeds the same single text twice, in the same role and batch shape", async () => {
    const embed = embedReturning([vector([1, 0])], [vector([1, 0])]);

    await buildDeterminismProbe(anchors, embed);

    expect(embed).toHaveBeenCalledTimes(2);
    expect(embed).toHaveBeenNthCalledWith(1, ["first question"], "query");
    expect(embed).toHaveBeenNthCalledWith(2, ["first question"], "query");
  });

  it("fails when an embedding returns nothing", async () => {
    const embed = embedReturning([vector([1, 0])], []);

    const probe = await buildDeterminismProbe(anchors, embed);

    expect(probe.passed).toBe(false);
    expect(probe.detail).toMatch(/returned nothing/);
  });

  it("fails when there was no probe text to embed", async () => {
    const embed = vi.fn();

    const probe = await buildDeterminismProbe([], embed);

    expect(probe.passed).toBe(false);
    expect(embed).not.toHaveBeenCalled();
  });
});

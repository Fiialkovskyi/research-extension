import { describe, expect, it } from "vitest";

import { matchClusterIdentity } from ".";

const cluster = (id: string, memberIds: string[]) => ({ id, label: id, memberIds });

const counter = () => {
  let next = 0;

  return () => `new-${(next += 1)}`;
};

describe("matchClusterIdentity", () => {
  it("keeps the id of the previous cluster sharing the most pages", () => {
    expect(
      matchClusterIdentity(
        [
          ["a", "b", "e"],
          ["c", "d"],
        ],
        [cluster("K", ["a", "b"]), cluster("L", ["c", "d"])],
        counter(),
      ),
    ).toEqual(["K", "L"]);
  });

  it("gives no previous id twice, the larger overlap winning", () => {
    expect(
      matchClusterIdentity([["a"], ["b", "c"]], [cluster("K", ["a", "b", "c"])], counter()),
    ).toEqual(["new-1", "K"]);
  });

  it("breaks a tie by the smaller previous id, whatever the order given", () => {
    const previous = [cluster("L", ["a"]), cluster("K", ["b"])];

    expect(matchClusterIdentity([["a", "b"]], previous, counter())).toEqual(["K"]);
    expect(matchClusterIdentity([["b", "a"]], previous.toReversed(), counter())).toEqual(["K"]);
  });

  it("gives a group sharing nothing a new id", () => {
    expect(matchClusterIdentity([["z"]], [cluster("K", ["a"])], counter())).toEqual(["new-1"]);
    expect(matchClusterIdentity([["a"]], [], counter())).toEqual(["new-1"]);
  });
});

import { describe, expect, it } from "vitest";

import { proposeColumns } from ".";
import type { TableFact } from "../../types";

const fact = (rowId: string, attribute: string): TableFact => ({
  id: `${rowId}-${attribute}`,
  rowId,
  nodeId: "n",
  attribute,
  attributeKey: attribute.toLowerCase(),
  value: "1",
  quote: "q",
  pageTitle: "p",
  url: "u",
});

const FACTS = [
  ...["a", "b", "c", "d"].map((row) => fact(row, "weight")),
  fact("a", "Price"),
  fact("b", "price"),
  fact("c", "Price"),
  fact("a", "colour"),
];

describe("proposeColumns", () => {
  it("ranks attributes by how many rows have them, merging spellings, labelled by the commonest", () => {
    expect(proposeColumns(FACTS).columns).toEqual([
      { key: "weight", label: "weight" },
      { key: "price", label: "Price" },
      { key: "colour", label: "colour" },
    ]);
  });

  it("proposes at most 8 and offers the rest", () => {
    const many = Array.from({ length: 10 }, (_, index) => fact("a", `attribute ${index}`));
    const { columns, otherColumns } = proposeColumns(many);

    expect(columns).toHaveLength(8);
    expect(otherColumns).toHaveLength(2);
  });

  it("shows saved columns in their order, dropping any no fact has", () => {
    const { columns, otherColumns } = proposeColumns(FACTS, ["colour", "gone", "weight"]);

    expect(columns.map(({ key }) => key)).toEqual(["colour", "weight"]);
    expect(otherColumns.map(({ key }) => key)).toEqual(["price"]);
  });
});

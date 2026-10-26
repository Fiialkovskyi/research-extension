import { describe, expect, it } from "vitest";

import { proposeColumns } from ".";
import type { TableFact } from "../../types";

const PROSE = "a long description of the product that runs on for more than eight words";

const fact = (rowId: string, attribute: string, value = rowId): TableFact => ({
  id: `${rowId}-${attribute}`,
  rowId,
  nodeId: "n",
  attribute,
  attributeKey: attribute.toLowerCase(),
  value,
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
    ]);
  });

  it("leaves prose among the other columns, whatever the attribute is called", () => {
    const facts = ["a", "b"].flatMap((row) => [
      fact(row, "description", `${PROSE} ${row}`),
      fact(row, "weight"),
    ]);
    const { columns, otherColumns } = proposeColumns(facts);

    expect(columns.map(({ key }) => key)).toEqual(["weight"]);
    expect(otherColumns.map(({ key }) => key)).toEqual(["description"]);
  });

  it("leaves an attribute only one row has among the other columns, in a table of several rows", () => {
    const { columns, otherColumns } = proposeColumns(FACTS);

    expect(columns.map(({ key }) => key)).not.toContain("colour");
    expect(otherColumns.map(({ key }) => key)).toEqual(["colour"]);
  });

  it("leaves out what every row states with the same value", () => {
    const facts = ["a", "b", "c"].flatMap((row) => [
      fact(row, "category", "bath mat"),
      fact(row, "pile height"),
    ]);
    const { columns, otherColumns } = proposeColumns(facts);

    expect(columns.map(({ key }) => key)).toEqual(["pile height"]);
    expect(otherColumns.map(({ key }) => key)).toEqual(["category"]);
  });

  it("proposes by rank everything a single row has, but prose", () => {
    const { columns, otherColumns } = proposeColumns([
      fact("a", "weight"),
      fact("a", "colour"),
      fact("a", "summary", PROSE),
    ]);

    expect(columns.map(({ key }) => key)).toEqual(["colour", "weight"]);
    expect(otherColumns.map(({ key }) => key)).toEqual(["summary"]);
  });

  it("proposes at most 8 and offers the rest", () => {
    const many = ["a", "b"].flatMap((row) =>
      Array.from({ length: 10 }, (_, index) => fact(row, `attribute ${index}`)),
    );
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

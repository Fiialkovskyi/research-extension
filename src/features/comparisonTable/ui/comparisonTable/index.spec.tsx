import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComparisonTable } from ".";
import type { ComparisonTable as Table } from "../../types";

const source = (
  factId: string,
  url: string,
  details: { siteName?: string; publishedDate?: string } = {},
) => ({
  factId,
  pageTitle: url,
  url,
  quote: `quote ${factId}`,
  ...details,
});

const TABLE: Table = {
  types: [
    { type: "product", rowCount: 2 },
    { type: "company", rowCount: 1 },
  ],
  entityType: "product",
  columns: [
    { key: "weight", label: "weight" },
    { key: "price", label: "price" },
  ],
  otherColumns: [{ key: "colour", label: "colour" }],
  rejectedCount: 0,
  rows: [
    {
      entityId: "volta",
      name: "Volta E5",
      cells: {
        weight: {
          value: "23.5 kg",
          alternativeCount: 0,
          isConflict: false,
          groups: [{ value: "23.5 kg", sources: [source("a", "https://a")] }],
        },
        price: {
          value: "1749 USD",
          alternativeCount: 1,
          isConflict: true,
          groups: [
            {
              value: "1749 USD",
              sources: [
                source("b", "https://a", { siteName: "Bike Lab", publishedDate: "2025-01-10" }),
              ],
            },
            {
              value: "1999 USD",
              sources: [source("c", "https://b", { publishedDate: "2026-05-01" })],
              isNewest: true,
            },
          ],
        },
      },
    },
    { entityId: "corsa", name: "Corsa", cells: {} },
  ],
};

const renderTable = (table = TABLE) => {
  const handlers = {
    onChooseType: vi.fn(),
    onSetColumns: vi.fn(),
    onExport: vi.fn(),
    onReject: vi.fn(),
    onRestore: vi.fn(),
  };

  render(<ComparisonTable table={table} {...handlers} />);

  return handlers;
};

describe("ComparisonTable", () => {
  it("shows a row per entity and a column per attribute", () => {
    renderTable();

    expect(
      screen.getAllByTestId("table-row").map((row) => row.textContent?.split(/\d/u)[0]),
    ).toEqual(["Volta E", "Corsa"]);
    expect(screen.getAllByTestId("table-column").map((column) => column.textContent)).toEqual([
      "weight ✕",
      "price ✕",
    ]);
  });

  it("marks a conflict, counts alternatives, and lists every value with its sources", () => {
    renderTable();

    const [, price] = within(screen.getAllByTestId("table-row")[0]!).getAllByTestId("table-cell");

    expect(price).toHaveAttribute("data-conflict", "true");
    expect(price).toHaveTextContent("+1");
    expect(
      within(price!)
        .getAllByTestId("table-value")
        .map((value) => value.textContent),
    ).toEqual([
      "1749 USD Wronghttps://a (Bike Lab, 2025-01-10): quote b",
      "1999 USD newest source Wronghttps://b (2026-05-01): quote c",
    ]);
    expect(within(price!).getAllByRole("link")[1]).toHaveAttribute("href", "https://b");
  });

  it("shows options together, without the conflict tag, each value with its source", () => {
    const [volta] = TABLE.rows;

    renderTable({
      ...TABLE,
      rows: [
        {
          ...(volta as NonNullable<typeof volta>),
          cells: {
            weight: {
              value: "128 GB",
              alternativeCount: 0,
              isConflict: false,
              isOptions: true,
              groups: [
                { value: "128 GB", sources: [source("a", "https://a")] },
                { value: "256 GB", sources: [source("b", "https://a")] },
              ],
            },
          },
        },
      ],
    });

    const [weight] = within(screen.getAllByTestId("table-row")[0]!).getAllByTestId("table-cell");

    expect(weight).toHaveAttribute("data-options", "true");
    expect(weight).toHaveAttribute("data-conflict", "false");
    expect(within(weight!).queryByTestId("table-conflict")).toBeNull();
    expect(within(weight!).getAllByTestId("table-value")).toHaveLength(2);
    expect(weight?.querySelector("summary")).toHaveTextContent("128 GB / 256 GB");
  });

  it("names a source's site and day, and tags the newest source of a conflict", () => {
    renderTable();

    const [, price] = within(screen.getAllByTestId("table-row")[0]!).getAllByTestId("table-cell");

    expect(
      within(price!)
        .getAllByTestId("table-source-details")
        .map((details) => details.textContent),
    ).toEqual([" (Bike Lab, 2025-01-10)", " (2026-05-01)"]);
    expect(within(price!).getAllByTestId("table-newest")).toHaveLength(1);
    expect(within(price!).getByTestId("table-newest")).toHaveTextContent("newest source");
  });

  it("shows a source without details, and no tag, as it was", () => {
    renderTable();

    const [weight] = within(screen.getAllByTestId("table-row")[0]!).getAllByTestId("table-cell");

    expect(within(weight!).queryByTestId("table-source-details")).toBeNull();
    expect(within(weight!).queryByTestId("table-newest")).toBeNull();
  });

  it("chooses another type", () => {
    const { onChooseType } = renderTable();

    fireEvent.change(screen.getByTestId("table-type"), { target: { value: "company" } });

    expect(onChooseType).toHaveBeenCalledWith("company");
  });

  it("removes a column and adds another", () => {
    const { onSetColumns } = renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Remove the column weight" }));
    expect(onSetColumns).toHaveBeenLastCalledWith("product", ["price"]);

    fireEvent.change(screen.getByTestId("table-add-column"), { target: { value: "colour" } });
    expect(onSetColumns).toHaveBeenLastCalledWith("product", ["weight", "price", "colour"]);
  });

  it("marks every fact behind a value wrong", () => {
    const { onReject } = renderTable();

    fireEvent.click(screen.getAllByTestId("table-reject")[2]!);

    expect(onReject).toHaveBeenCalledWith(["c"]);
  });

  it("counts rejected values and restores them, and shows nothing when there are none", () => {
    const { onRestore } = renderTable({ ...TABLE, rejectedCount: 2 });

    expect(screen.getByTestId("table-rejected")).toHaveTextContent("2 values marked wrong");
    fireEvent.click(screen.getByTestId("table-restore"));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("shows no rejection count before any rejection", () => {
    renderTable();

    expect(screen.queryByTestId("table-rejected")).toBeNull();
  });

  it("exports on request", () => {
    const { onExport } = renderTable();

    fireEvent.click(screen.getByTestId("table-export"));

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("says when there is nothing to compare yet", () => {
    renderTable({ ...TABLE, types: [], entityType: null, columns: [], otherColumns: [], rows: [] });

    expect(screen.getByTestId("table-empty")).toBeInTheDocument();
  });
});

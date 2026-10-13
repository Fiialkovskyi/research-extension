import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResearchGaps } from ".";

const GAPS = {
  cellGaps: [{ kind: "cell" as const, text: "No price for Neo", query: "Neo price" }],
  moreCellGaps: 3,
  categoryGaps: [{ kind: "category" as const, text: "No reviews read yet", query: "Neo review" }],
};

describe("ResearchGaps", () => {
  it("lists cell and category gaps, and how many more cells are missing", () => {
    render(<ResearchGaps gaps={GAPS} onSearch={vi.fn()} />);

    expect(screen.getAllByTestId("gap").map((gap) => gap.dataset.kind)).toEqual([
      "cell",
      "category",
    ]);
    expect(screen.getByTestId("gaps-more")).toHaveTextContent("3 more");
  });

  it("searches a gap's query", () => {
    const onSearch = vi.fn();

    render(<ResearchGaps gaps={GAPS} onSearch={onSearch} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Search this" })[1]!);

    expect(onSearch).toHaveBeenCalledWith("Neo review");
  });

  it("says when nothing is missing", () => {
    render(
      <ResearchGaps
        gaps={{ cellGaps: [], moreCellGaps: 0, categoryGaps: [] }}
        onSearch={vi.fn()}
      />,
    );

    expect(screen.getByTestId("gaps-none")).toBeInTheDocument();
  });
});

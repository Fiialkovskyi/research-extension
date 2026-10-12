import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UnreadQueue } from ".";
import type { MapNode } from "@/features/researchMap";

const page = (id: string, tabId: number) =>
  ({ id, title: `Page ${id}`, url: `https://example.org/${id}`, tabId }) as MapNode;

describe("UnreadQueue", () => {
  it("counts the unread pages and lists them in the order given", () => {
    render(<UnreadQueue pages={[page("C", 3), page("D", 4)]} onFocusTab={() => {}} />);

    expect(screen.getByTestId("unread-count")).toHaveTextContent("Unread: 2");
    expect(screen.getAllByTestId("unread-page").map((entry) => entry.textContent)).toEqual([
      "Page C",
      "Page D",
    ]);
  });

  it("says when nothing is unread", () => {
    render(<UnreadQueue pages={[]} onFocusTab={() => {}} />);

    expect(screen.getByTestId("unread-count")).toHaveTextContent("Nothing unread");
    expect(screen.queryByTestId("unread-page")).toBeNull();
  });

  it("selects a page's tab when its entry is activated", () => {
    const onFocusTab = vi.fn();

    render(<UnreadQueue pages={[page("C", 3)]} onFocusTab={onFocusTab} />);
    fireEvent.click(screen.getByRole("button", { name: "Page C" }));

    expect(onFocusTab).toHaveBeenCalledWith(3);
  });
});

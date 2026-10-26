import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SourceLines, type SourceCitation } from ".";

const cite = (factId: string, url: string, overrides: Partial<SourceCitation> = {}) => ({
  factId,
  pageTitle: "Купити Apple iPhone 17 256GB — ціна | Яблуко",
  url,
  quote: `quote ${factId}`,
  ...overrides,
});

const show = (citations: SourceCitation[], onReject = vi.fn()) =>
  render(
    <SourceLines
      citations={citations}
      onReject={onReject}
      lineTestId="line"
      rejectTestId="wrong"
    />,
  );

describe("SourceLines", () => {
  it("names a page by its site, with its title as the tooltip", () => {
    show([
      cite("a", "https://shop.example/p", { siteName: "Яблуко", publishedDate: "2026-05-01" }),
    ]);

    const link = screen.getByRole("link", { name: "Яблуко" });

    expect(link).toHaveAttribute("title", expect.stringContaining("Купити Apple iPhone 17"));
    expect(screen.getByTestId("source-date")).toHaveTextContent("(2026-05-01)");
  });

  it("names a page without a site by its host", () => {
    show([cite("a", "https://www.shop.example/p")]);

    expect(screen.getByRole("link", { name: "shop.example" })).toBeInTheDocument();
    expect(screen.queryByTestId("source-date")).toBeNull();
  });

  it("makes one line of a page that gave three quotes, the others behind a disclosure", () => {
    show([
      cite("a", "https://a.example/p"),
      cite("b", "https://b.example/p"),
      cite("c", "https://a.example/p"),
      cite("d", "https://a.example/p"),
    ]);

    const lines = screen.getAllByTestId("line");

    expect(lines).toHaveLength(2);
    expect(within(lines[0]!).getByText("2 more quotes")).toBeInTheDocument();
    expect(within(lines[1]!).queryByText(/more quotes/u)).toBeNull();
  });

  it("marks only the quote it was asked about wrong", () => {
    const onReject = vi.fn();

    show([cite("a", "https://a.example/p"), cite("b", "https://a.example/p")], onReject);

    const buttons = screen.getAllByTestId("wrong");

    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[1]!);

    expect(onReject).toHaveBeenCalledWith(["b"]);
  });
});

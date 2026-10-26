import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductCards } from ".";
import type { ProductCard } from "../../types";

const CARD: ProductCard = {
  entityId: "pixel",
  name: "Google Pixel 10a",
  factCount: 9,
  price: {
    label: "price",
    value: "24399 UAH",
    citations: [
      {
        factId: "p:product:0",
        pageTitle: "Pixel page",
        url: "https://jabko.ua/pixel",
        quote: "From the page's data: price 24399 UAH",
        siteName: "Ябко",
        publishedDate: "2026-02-01",
      },
    ],
  },
  specs: [
    {
      label: "battery capacity",
      value: "5100 mAh",
      citations: [
        { factId: "a", pageTitle: "Pixel page", url: "https://jabko.ua/pixel", quote: "5100 mAh" },
      ],
    },
    { label: "weight", value: "190 g", citations: [] },
  ],
};

const renderCards = (cards = [CARD], omittedProductCount = 0) => {
  const onReject = vi.fn();

  render(
    <ProductCards cards={cards} omittedProductCount={omittedProductCount} onReject={onReject} />,
  );

  return onReject;
};

describe("ProductCards", () => {
  it("shows a card with the product's name, its price and its key specs", () => {
    renderCards();

    const card = screen.getByTestId("product-card");

    expect(within(card).getByTestId("card-name")).toHaveTextContent("Google Pixel 10a");
    expect(within(card).getByTestId("card-price")).toHaveTextContent("price: 24399 UAH");
    expect(
      within(card)
        .getAllByTestId("card-spec")
        .map((spec) => spec.querySelector("summary")?.textContent),
    ).toEqual(["battery capacity: 5100 mAh", "weight: 190 g"]);
  });

  it("opens a value to its page, site and day and quote, with a control to mark it wrong", () => {
    const onReject = renderCards();
    const price = screen.getByTestId("card-price");

    expect(within(price).getByTestId("card-source")).toHaveTextContent(
      "Ябко (2026-02-01): From the page's data: price 24399 UAH",
    );
    expect(within(price).getByRole("link")).toHaveAttribute("href", "https://jabko.ua/pixel");
    expect(within(price).getByRole("link")).toHaveAttribute("title", "Pixel page");

    fireEvent.click(within(price).getByTestId("card-reject"));

    expect(onReject).toHaveBeenCalledWith(["p:product:0"]);
  });

  it("shows no price for a product without one", () => {
    renderCards([{ ...CARD, price: null }]);

    expect(screen.queryByTestId("card-price")).toBeNull();
  });

  it("says how many more products there were, and shows nothing without cards", () => {
    renderCards([CARD], 2);

    expect(screen.getByTestId("cards-omitted")).toHaveTextContent("+2 more products");
  });

  it("renders nothing for a cluster without cards", () => {
    renderCards([]);

    expect(screen.queryByTestId("product-cards")).toBeNull();
  });
});

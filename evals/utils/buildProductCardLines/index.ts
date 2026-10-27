import type { ProductCard } from "@/features/clusterSummaries";

/** One line for each card: the product, how many facts stand behind it, its price and key specs. */
export const buildProductCardLines = (cards: readonly ProductCard[]): string[] =>
  cards.map(({ name, factCount, price, specs }) => {
    const values = [
      ...(price === null ? [] : [`price ${price.value}`]),
      ...specs.map(({ label, value }) => `${label} ${value}`),
    ];

    return `  ${name} (${factCount} facts): ${values.join("; ") || "no specs"}`;
  });

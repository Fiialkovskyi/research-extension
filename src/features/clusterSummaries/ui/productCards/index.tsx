import { describePageSource } from "@/shared/describePageSource";

import type { CardValue, ProductCard } from "../../types";

export interface ProductCardsProps {
  cards: readonly ProductCard[];
  /** How many products were left out of `cards` for the limit. */
  omittedProductCount: number;
  /** Marks a fact wrong (REQ-LIN-008). */
  onReject: (factIds: string[]) => void;
}

/** One value of a card: shown as the pages wrote it, opening to the pages and quotes it rests on. */
function Value({
  testId,
  value,
  onReject,
}: {
  testId: string;
  value: CardValue;
  onReject: (factIds: string[]) => void;
}) {
  return (
    <details data-testid={testId}>
      <summary className="cursor-pointer text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">{value.label}:</span> {value.value}
      </summary>
      <ul className="mt-1 flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
        {value.citations.map((citation) => (
          <li key={citation.factId} data-testid="card-source">
            <a href={citation.url} target="_blank" rel="noreferrer" className="underline">
              {citation.pageTitle}
            </a>
            {describePageSource(citation) !== "" && <span> ({describePageSource(citation)})</span>}:{" "}
            <q>{citation.quote}</q>{" "}
            <button
              type="button"
              data-testid="card-reject"
              className="cursor-pointer text-red-700 underline dark:text-red-400"
              onClick={() => {
                onReject([citation.factId]);
              }}
            >
              Wrong
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The products a cluster's facts describe, a card each: the name, the price
 * and the key specs, made from the facts with no model, every value opening to
 * its page and quote and markable wrong.
 */
export function ProductCards({ cards, omittedProductCount, onReject }: ProductCardsProps) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <div data-testid="product-cards" className="mt-2">
      <ul className="grid gap-2 sm:grid-cols-2">
        {cards.map((card) => (
          <li
            key={card.entityId}
            data-testid="product-card"
            className="rounded border border-neutral-200 p-2 dark:border-neutral-800"
          >
            <h3 data-testid="card-name" className="font-medium">
              {card.name}
            </h3>
            {card.price !== null && (
              <div className="font-semibold">
                <Value testId="card-price" value={card.price} onReject={onReject} />
              </div>
            )}
            <div className="mt-1 flex flex-col gap-0.5">
              {card.specs.map((spec) => (
                <Value key={spec.label} testId="card-spec" value={spec} onReject={onReject} />
              ))}
            </div>
          </li>
        ))}
      </ul>
      {omittedProductCount > 0 && (
        <p
          data-testid="cards-omitted"
          className="mt-1 text-xs text-neutral-500 dark:text-neutral-400"
        >
          +{omittedProductCount} more products
        </p>
      )}
    </div>
  );
}

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClusterSummaries } from ".";
import type { ClusterSummaryView } from "../../types";

const SUMMARIZED: ClusterSummaryView = {
  clusterId: "bikes",
  label: "E-bikes",
  factCount: 14,
  cards: [],
  omittedProductCount: 0,
  isPending: false,
  summary: {
    statements: [
      {
        text: "The Volta E5 weighs 23.5 kg.",
        citations: [
          {
            factId: "a:0:0",
            pageTitle: "Volta review",
            url: "https://example.org/volta",
            quote: "weighs 23.5 kg",
          },
        ],
      },
    ],
    isStale: false,
    omittedFactCount: 0,
    generatedAt: 1,
    modelName: "qwen3:4b",
  },
};

const WITH_DETAILS: ClusterSummaryView = {
  ...SUMMARIZED,
  summary: {
    ...(SUMMARIZED.summary as NonNullable<ClusterSummaryView["summary"]>),
    statements: [
      {
        text: "The Volta E5 weighs 23.5 kg.",
        citations: [
          {
            factId: "a:0:0",
            pageTitle: "Volta review",
            url: "https://example.org/volta",
            quote: "weighs 23.5 kg",
            siteName: "Bike Lab",
            publishedDate: "2026-05-01",
          },
        ],
      },
    ],
  },
};

const onReject = vi.fn();

const renderSummaries = (clusters: ClusterSummaryView[], canSummarize = true) => {
  const onSummarize = vi.fn();

  render(
    <ClusterSummaries
      title="E-bikes"
      clusters={clusters}
      canSummarize={canSummarize}
      onSummarize={onSummarize}
      onReject={onReject}
    />,
  );

  return onSummarize;
};

describe("ClusterSummaries", () => {
  it("shows each statement with links to its pages and their quotes", () => {
    renderSummaries([SUMMARIZED]);

    const statement = screen.getByTestId("summary-statement");
    const link = within(statement).getByRole("link", { name: "Volta review" });

    expect(statement).toHaveTextContent("The Volta E5 weighs 23.5 kg.");
    expect(link).toHaveAttribute("href", "https://example.org/volta");
    expect(within(statement).getByTestId("summary-citation")).toHaveTextContent("weighs 23.5 kg");
    expect(screen.queryByTestId("summary-summarize")).toBeNull();
  });

  it("names a citation's site and day when its page gave them", () => {
    renderSummaries([WITH_DETAILS]);

    expect(screen.getByTestId("summary-citation-details")).toHaveTextContent(
      "(Bike Lab, 2026-05-01)",
    );
  });

  it("shows a citation without details as it was", () => {
    renderSummaries([SUMMARIZED]);

    expect(screen.queryByTestId("summary-citation-details")).toBeNull();
  });

  it("marks a cited fact wrong", () => {
    renderSummaries([SUMMARIZED]);
    fireEvent.click(screen.getByTestId("summary-reject"));

    expect(onReject).toHaveBeenCalledWith(["a:0:0"]);
  });

  it("dims a stale summary and offers to refresh it", () => {
    const onSummarize = renderSummaries([
      { ...SUMMARIZED, summary: { ...SUMMARIZED.summary!, isStale: true } },
    ]);

    expect(screen.getByTestId("summary-cluster")).toHaveAttribute("data-stale", "true");
    expect(screen.getByTestId("summary-stale")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onSummarize).toHaveBeenCalledWith("bikes");
  });

  it("offers to summarize a cluster with facts and no summary, and waits while pending", () => {
    const onSummarize = renderSummaries([{ ...SUMMARIZED, summary: null }]);

    expect(screen.getByTestId("summary-none")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Summarize now" }));
    expect(onSummarize).toHaveBeenCalledWith("bikes");
  });

  it("disables the button while a summary is being written", () => {
    renderSummaries([{ ...SUMMARIZED, summary: null, isPending: true }]);

    expect(screen.getByRole("button", { name: "Summarizing…" })).toBeDisabled();
  });

  it("says when a cluster has no facts, and offers nothing", () => {
    renderSummaries([{ ...SUMMARIZED, factCount: 0, summary: null }]);

    expect(screen.getByTestId("summary-no-facts")).toBeInTheDocument();
    expect(screen.queryByTestId("summary-summarize")).toBeNull();
  });

  it("says summaries need a generation model when none is active", () => {
    renderSummaries([{ ...SUMMARIZED, summary: null }], false);

    expect(screen.getByTestId("summaries-no-model")).toBeInTheDocument();
    expect(screen.queryByTestId("summary-summarize")).toBeNull();
  });

  it("says which model wrote the summary", () => {
    renderSummaries([SUMMARIZED]);

    expect(screen.getByTestId("summary-cluster")).toHaveTextContent("Written by qwen3:4b");
  });

  it("notes when the summary was written from a selection of the facts", () => {
    renderSummaries([{ ...SUMMARIZED, summary: { ...SUMMARIZED.summary!, omittedFactCount: 30 } }]);

    expect(screen.getByTestId("summary-cluster")).toHaveTextContent("30 left out");
  });
});

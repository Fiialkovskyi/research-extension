import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SuggestedQuestions } from ".";
import type { OpenQuestionsView } from "../../types";

const VIEW: OpenQuestionsView = {
  questions: [{ question: "Is the battery removable?", query: "volta battery removable" }],
  hasQuestions: true,
  isStale: false,
  isPending: false,
  canSuggest: true,
  modelName: "qwen3:4b",
};

const renderQuestions = (view: OpenQuestionsView = VIEW) => {
  const handlers = { onSearch: vi.fn(), onSuggest: vi.fn() };

  render(<SuggestedQuestions view={view} {...handlers} />);

  return handlers;
};

describe("SuggestedQuestions", () => {
  it("lists the questions, labelled as suggestions, and searches one", () => {
    const { onSearch } = renderQuestions();

    expect(screen.getByText(/Suggested by qwen3:4b/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search this" }));
    expect(onSearch).toHaveBeenCalledWith("volta battery removable");
    expect(screen.queryByTestId("questions-suggest")).toBeNull();
  });

  it("dims stale questions and offers to refresh them", () => {
    const { onSuggest } = renderQuestions({ ...VIEW, isStale: true });

    expect(screen.getByTestId("questions-list")).toHaveAttribute("data-stale", "true");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onSuggest).toHaveBeenCalledTimes(1);
  });

  it("offers to suggest questions when there are none, and waits while pending", () => {
    renderQuestions({ ...VIEW, questions: [], hasQuestions: false, isPending: true });

    expect(screen.getByRole("button", { name: "Suggesting…" })).toBeDisabled();
  });

  it("says a generation model is needed without one", () => {
    renderQuestions({ ...VIEW, questions: [], hasQuestions: false, canSuggest: false });

    expect(screen.getByTestId("questions-no-model")).toBeInTheDocument();
  });
});

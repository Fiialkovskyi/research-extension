import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecordedPage } from ".";
import type { RecordedSession } from "../../types";

const SESSION: RecordedSession = {
  id: "session-1",
  title: "E-bike motors",
  status: "active",
  pages: [
    {
      id: "a",
      title: "Mid-drive motors",
      url: "https://example.org/a",
      domain: "example.org",
      kind: "page",
      tabState: "open",
      createdAt: 1,
      signals: {
        activeDwellMs: 120_000,
        maxScroll: 0.8,
        copyEvents: 1,
        focusCount: 3,
        revisitCount: 1,
        quickReturnCount: 0,
      },
      snapshot: { byteLength: 12_288, truncated: false, capturedAt: 2 },
      vectorCount: 4,
    },
  ],
};

const renderPage = (texts = new Map<string, string | null>()) => {
  const handlers = { onShowText: vi.fn(), onDeleteNode: vi.fn(), onDeleteSession: vi.fn() };

  render(<RecordedPage session={SESSION} texts={texts} {...handlers} />);

  return handlers;
};

describe("RecordedPage", () => {
  it("shows what was kept about each page", () => {
    renderPage();

    const entry = screen.getByTestId("recorded-entry");

    expect(entry).toHaveTextContent("Mid-drive motors");
    expect(within(entry).getByTestId("recorded-dwell")).toHaveTextContent("2 min 0 s");
    expect(within(entry).getByTestId("recorded-scroll")).toHaveTextContent("80%");
    expect(within(entry).getByTestId("recorded-copies")).toHaveTextContent("1");
    expect(within(entry).getByTestId("recorded-snapshot")).toHaveTextContent("12.0 KB");
    expect(within(entry).getByTestId("recorded-vectors")).toHaveTextContent("4");
  });

  it("asks for a page's text only when the user does, and shows it once read", () => {
    const { onShowText } = renderPage();

    expect(screen.queryByTestId("recorded-text")).toBeNull();
    fireEvent.click(screen.getByTestId("recorded-show-text"));
    expect(onShowText).toHaveBeenCalledWith("a");
  });

  it("shows a page's text once it was read", () => {
    renderPage(new Map([["a", "A mid-drive motor sits at the cranks."]]));

    expect(screen.getByTestId("recorded-text")).toHaveTextContent("sits at the cranks");
    expect(screen.queryByTestId("recorded-show-text")).toBeNull();
  });

  it("deletes a page, or the session, only once confirmed", () => {
    const { onDeleteNode, onDeleteSession } = renderPage();

    fireEvent.click(screen.getByTestId("recorded-delete-page"));
    expect(onDeleteNode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("recorded-delete-page-confirm"));
    expect(onDeleteNode).toHaveBeenCalledWith("a");

    fireEvent.click(screen.getByTestId("recorded-delete-session"));
    fireEvent.click(screen.getByTestId("recorded-delete-session-confirm"));
    expect(onDeleteSession).toHaveBeenCalledWith("session-1");
  });
});

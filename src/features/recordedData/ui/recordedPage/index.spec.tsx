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
      metadata: {
        title: "Mid-drive motors explained",
        siteName: "Bike Lab",
        hasDescription: true,
      },
      vectorCount: 4,
      facts: { kept: 7, dropped: 2, isFinished: true },
    },
  ],
  canExtractFacts: false,
  entities: [],
};

const renderPage = (texts = new Map<string, string | null>(), session = SESSION) => {
  const handlers = {
    onShowText: vi.fn(),
    onDeleteNode: vi.fn(),
    onDeleteSession: vi.fn(),
    onExtractFacts: vi.fn(),
    onSeparateEntity: vi.fn(),
  };

  render(<RecordedPage session={session} texts={texts} {...handlers} />);

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
    expect(within(entry).getByTestId("recorded-metadata")).toHaveTextContent(
      "Mid-drive motors explained · Bike Lab · description kept",
    );
    expect(within(entry).getByTestId("recorded-vectors")).toHaveTextContent("4");
    expect(within(entry).getByTestId("recorded-facts")).toHaveTextContent("7 kept, 2 dropped");
  });

  it("says when no page details were kept", () => {
    const [page] = SESSION.pages;

    renderPage(new Map(), {
      ...SESSION,
      pages: [{ ...(page as NonNullable<typeof page>), metadata: null }],
    });

    expect(screen.getByTestId("recorded-metadata")).toHaveTextContent("none kept");
  });

  it("says a page is not extracted yet, or still extracting", () => {
    const [page] = SESSION.pages;

    renderPage(undefined, {
      ...SESSION,
      pages: [
        { ...page!, id: "x", facts: null },
        { ...page!, id: "y", facts: { kept: 1, dropped: 0, isFinished: false } },
      ],
    });

    const [notYet, under] = screen.getAllByTestId("recorded-facts");

    expect(notYet).toHaveTextContent("not extracted");
    expect(under).toHaveTextContent("1 kept, 0 dropped, extracting…");
  });

  it("offers to extract facts now only with a generation model active", () => {
    renderPage();
    expect(screen.queryByTestId("recorded-extract-facts")).toBeNull();
  });

  it("shows extraction under way: the button waits, and pages not begun say so", () => {
    const [page] = SESSION.pages;

    render(
      <RecordedPage
        session={{ ...SESSION, canExtractFacts: true, pages: [{ ...page!, facts: null }] }}
        texts={new Map()}
        onShowText={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteSession={vi.fn()}
        onExtractFacts={vi.fn()}
        onSeparateEntity={vi.fn()}
        isExtracting
      />,
    );

    const button = screen.getByTestId("recorded-extract-facts");

    expect(button).toHaveTextContent("Extracting facts…");
    expect(button).toBeDisabled();
    expect(screen.getByTestId("recorded-facts")).toHaveTextContent("waiting for the model…");
  });

  it("says no entities were found yet", () => {
    renderPage();

    expect(screen.getByTestId("recorded-entities-empty")).toHaveTextContent(
      "No entities found yet.",
    );
  });

  it("lists entities with their counts and merged names, and separates one on request", () => {
    const { onSeparateEntity } = renderPage(undefined, {
      ...SESSION,
      entities: [
        {
          id: "neo",
          name: "MacBook Neo 13",
          type: "product",
          factCount: 12,
          pageCount: 2,
          merged: [{ id: "apple-neo", name: "Apple MacBook Neo 13 A18 Pro" }],
        },
      ],
    });

    const entity = screen.getByTestId("recorded-entity");

    expect(entity).toHaveTextContent("MacBook Neo 13");
    expect(entity).toHaveTextContent("product · 12 facts · 2 pages");
    expect(screen.getByTestId("recorded-merged-name")).toHaveTextContent(
      "Apple MacBook Neo 13 A18 Pro",
    );

    fireEvent.click(screen.getByTestId("recorded-separate-entity"));

    expect(onSeparateEntity).toHaveBeenCalledWith("apple-neo");
  });

  it("asks for extraction when the user chooses it", () => {
    const { onExtractFacts } = renderPage(undefined, { ...SESSION, canExtractFacts: true });

    fireEvent.click(screen.getByTestId("recorded-extract-facts"));

    expect(onExtractFacts).toHaveBeenCalledTimes(1);
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

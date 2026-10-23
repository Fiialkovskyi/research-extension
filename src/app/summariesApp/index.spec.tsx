import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SummariesApp, type SummariesClient } from ".";
import type { DataTopic } from "@/features/liveData";
import { buildRpcMessage, type RpcMessage } from "@/shared/rpc";

const cluster = (summary: unknown, isPending = false) => ({
  clusterId: "bikes",
  label: "E-bikes",
  factCount: 2,
  isPending,
  summary,
});

const SUMMARY = {
  statements: [{ text: "Volta is lighter.", citations: [] }],
  isStale: false,
  omittedFactCount: 0,
  generatedAt: 1,
  modelName: "qwen3:4b",
};

/** A background holding one unsummarized cluster, summarized on the second read after asking. */
const createClient = (hasSession = true) => {
  let reads = 0;
  let isRequested = false;
  const sent: string[] = [];
  let listener: ((topics: readonly DataTopic[]) => void) | undefined;
  const client: SummariesClient = {
    watch: (onChange) => {
      listener = onChange;

      return () => {
        listener = undefined;
      };
    },
    request: vi.fn((message: RpcMessage<string, unknown>) => {
      sent.push(message.type);

      switch (message.type) {
        case "summaries.read": {
          reads += 1;

          const isWritten = isRequested && reads > 1;

          return Promise.resolve(
            buildRpcMessage("summaries.view", {
              session: hasSession
                ? {
                    title: "E-bikes",
                    canSummarize: true,
                    clusters: [cluster(isWritten ? SUMMARY : null, isRequested && !isWritten)],
                  }
                : null,
            }),
          );
        }
        case "table.read": {
          const type = (message.payload as { entityType?: string }).entityType ?? "product";

          return Promise.resolve(
            buildRpcMessage("table.view", {
              title: "E-bikes",
              table: hasSession
                ? {
                    types: [
                      { type: "product", rowCount: 1 },
                      { type: "company", rowCount: 1 },
                    ],
                    entityType: type,
                    columns: [{ key: "weight", label: "weight" }],
                    otherColumns: [],
                    rejectedCount: 0,
                    rows: [
                      {
                        entityId: "volta",
                        name: type === "product" ? "Volta E5" : "Acme",
                        cells: {
                          weight: {
                            value: "23.5 kg",
                            alternativeCount: 0,
                            isConflict: false,
                            groups: [
                              {
                                value: "23.5 kg",
                                sources: [
                                  { factId: "a", pageTitle: "p", url: "https://a", quote: "q" },
                                ],
                              },
                            ],
                          },
                        },
                      },
                    ],
                  }
                : null,
            }),
          );
        }
        case "gaps.read":
          return Promise.resolve(
            buildRpcMessage("gaps.view", {
              gaps: hasSession
                ? {
                    cellGaps: [],
                    moreCellGaps: 0,
                    categoryGaps: [
                      { kind: "category", text: "No reviews read yet", query: "Volta review" },
                    ],
                  }
                : null,
            }),
          );
        case "gaps.search":
          return Promise.resolve(buildRpcMessage("gaps.searchOpened", { url: "https://x" }));
        case "questions.read":
          return Promise.resolve(
            buildRpcMessage("questions.view", {
              view: hasSession
                ? {
                    questions: [{ question: "Warranty?", query: "volta warranty" }],
                    hasQuestions: true,
                    isStale: true,
                    isPending: false,
                    hasModel: true,
                    canSuggest: true,
                    modelName: "qwen3:4b",
                  }
                : null,
            }),
          );
        case "questions.refresh":
          return Promise.resolve(buildRpcMessage("questions.refreshing", { queued: true }));
        case "facts.reject":
          return Promise.resolve(buildRpcMessage("facts.rejected", { rejectionCount: 1 }));
        case "facts.restoreRejections":
          return Promise.resolve(buildRpcMessage("facts.rejectionsRestored", { restoredCount: 1 }));
        case "table.setColumns":
          return Promise.resolve(buildRpcMessage("table.columnsSaved", { entityType: "product" }));
        case "summaries.refresh":
          isRequested = true;
          reads = 0;
          return Promise.resolve(
            buildRpcMessage("summaries.refreshing", { clusterId: "bikes", queued: true }),
          );
        default:
          return Promise.reject(new Error(`Unexpected ${message.type}`));
      }
    }),
  };

  /** The background telling the page that data changed. */
  const emit = (topics: readonly DataTopic[]) => {
    act(() => {
      listener?.(topics);
    });
  };

  return { client, sent, emit };
};

describe("SummariesApp", () => {
  it("asks for a summary, then shows it when the background says it was written", async () => {
    const { client, sent, emit } = createClient();

    render(<SummariesApp client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: "Summarize now" }));
    await vi.waitFor(() => expect(sent).toContain("summaries.refresh"));

    emit(["summaries"]);

    expect(await screen.findByText("Volta is lighter.")).toBeInTheDocument();

    const reads = sent.filter((type) => type === "summaries.read").length;

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sent.filter((type) => type === "summaries.read")).toHaveLength(reads);
  });

  it("reads everything again when facts arrive, without a reload", async () => {
    const { client, sent, emit } = createClient();

    render(<SummariesApp client={client} />);
    await screen.findByText("Volta E5");

    const before = {
      summaries: sent.filter((type) => type === "summaries.read").length,
      questions: sent.filter((type) => type === "questions.read").length,
    };

    emit(["facts"]);

    await vi.waitFor(() => {
      expect(sent.filter((type) => type === "summaries.read")).toHaveLength(before.summaries + 1);
      expect(sent.filter((type) => type === "questions.read")).toHaveLength(before.questions + 1);
    });
  });

  it("shows the comparison table below the summaries, and switches its type", async () => {
    const { client, sent } = createClient();

    render(<SummariesApp client={client} />);

    expect(await screen.findByText("Volta E5")).toBeInTheDocument();
    expect(screen.getByTestId("summaries-title")).toHaveTextContent("Synthesis: E-bikes");

    fireEvent.change(screen.getByTestId("table-type"), { target: { value: "company" } });

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(sent.filter((type) => type === "table.read")).toHaveLength(2);
  });

  it("saves edited columns, then reads the table again", async () => {
    const { client, sent } = createClient();

    render(<SummariesApp client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove the column weight" }));

    await vi.waitFor(() => expect(sent.filter((type) => type === "table.read")).toHaveLength(2));
    expect(sent).toContain("table.setColumns");
  });

  it("exports the table as a CSV file named for the session and type", async () => {
    const { client } = createClient();
    const saveFile = vi.fn();

    render(<SummariesApp client={client} saveFile={saveFile} />);
    fireEvent.click(await screen.findByTestId("table-export"));

    expect(saveFile).toHaveBeenCalledWith(
      "E-bikes — product.csv",
      expect.stringContaining("Entity,weight,weight sources\r\nVolta E5,23.5 kg,https://a"),
    );
  });

  it("shows the gaps below the table, and searches one", async () => {
    const { client, sent } = createClient();

    render(<SummariesApp client={client} />);
    fireEvent.click((await screen.findAllByTestId("gap-search"))[0]!);

    await vi.waitFor(() => expect(sent).toContain("gaps.search"));
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({ type: "gaps.search", payload: { query: "Volta review" } }),
    );
  });

  it("reads the gaps again for another type", async () => {
    const { client, sent } = createClient();

    render(<SummariesApp client={client} />);
    fireEvent.change(await screen.findByTestId("table-type"), { target: { value: "company" } });

    await vi.waitFor(() => expect(sent.filter((type) => type === "gaps.read")).toHaveLength(2));
  });

  it("marks a value wrong, then reads summaries, the table and the gaps again", async () => {
    const { client, sent } = createClient();

    render(<SummariesApp client={client} />);
    fireEvent.click((await screen.findAllByTestId("table-reject"))[0]!);

    await vi.waitFor(() => expect(sent.filter((type) => type === "gaps.read")).toHaveLength(2));
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({ type: "facts.reject", payload: { factIds: ["a"] } }),
    );
    expect(sent.filter((type) => type === "summaries.read").length).toBeGreaterThan(1);
  });

  it("shows suggested questions, searches one, and refreshes stale ones", async () => {
    const { client, sent } = createClient();

    render(<SummariesApp client={client} />);

    expect(await screen.findByText("Warranty?")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Search this" }).at(-1)!);
    await vi.waitFor(() =>
      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "gaps.search", payload: { query: "volta warranty" } }),
      ),
    );

    fireEvent.click(screen.getByTestId("questions-suggest"));
    await vi.waitFor(() => expect(sent).toContain("questions.refresh"));
  });

  it("says there is nothing to show without a session", async () => {
    const { client } = createClient(false);

    render(<SummariesApp client={client} />);

    expect(await screen.findByTestId("summaries-empty")).toBeInTheDocument();
  });
});

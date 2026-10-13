import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SummariesApp, type SummariesClient } from ".";
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
};

/** A background holding one unsummarized cluster, summarized on the second read after asking. */
const createClient = (hasSession = true) => {
  let reads = 0;
  let isRequested = false;
  const sent: string[] = [];
  const client: SummariesClient = {
    request: vi.fn((message: RpcMessage<string, unknown>) => {
      sent.push(message.type);

      switch (message.type) {
        case "summaries.read": {
          reads += 1;

          const isWritten = isRequested && reads > 2;

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

  return { client, sent };
};

describe("SummariesApp", () => {
  it("asks for a summary, then reads again until it is written", async () => {
    const { client, sent } = createClient();

    render(<SummariesApp client={client} refreshIntervalMs={10} />);
    fireEvent.click(await screen.findByRole("button", { name: "Summarize now" }));

    expect(await screen.findByText("Volta is lighter.")).toBeInTheDocument();
    expect(sent).toContain("summaries.refresh");

    const reads = sent.filter((type) => type === "summaries.read").length;

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sent.filter((type) => type === "summaries.read")).toHaveLength(reads);
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
    fireEvent.click(await screen.findByRole("button", { name: "Search this" }));

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

  it("says there is nothing to show without a session", async () => {
    const { client } = createClient(false);

    render(<SummariesApp client={client} />);

    expect(await screen.findByTestId("summaries-empty")).toBeInTheDocument();
  });
});

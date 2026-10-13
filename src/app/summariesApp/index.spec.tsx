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

  it("says there is nothing to show without a session", async () => {
    const { client } = createClient(false);

    render(<SummariesApp client={client} />);

    expect(await screen.findByTestId("summaries-empty")).toBeInTheDocument();
  });
});

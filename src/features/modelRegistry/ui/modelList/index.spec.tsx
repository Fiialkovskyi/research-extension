import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModelList } from ".";
import type { InstalledModelSummary } from "../../constants";

const model = (overrides: Partial<InstalledModelSummary> = {}): InstalledModelSummary => ({
  ref: "Xenova/all-MiniLM-L6-v2@751bff37182d3f1213fa05d7196b954e230abad9",
  repository: "Xenova/all-MiniLM-L6-v2",
  revision: "751bff37182d3f1213fa05d7196b954e230abad9",
  family: "embedding",
  quantization: "q8",
  conformance: "pending",
  diskBytes: 22_972_370,
  active: false,
  installedAt: 1_760_000_000_000,
  ...overrides,
});

describe("ModelList", () => {
  it("says plainly that nothing is installed, rather than rendering an empty box", () => {
    render(<ModelList models={[]} />);

    expect(screen.getByTestId("model-list-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("model-list")).not.toBeInTheDocument();
  });

  it("names the repository", () => {
    render(<ModelList models={[model()]} />);

    expect(screen.getByText("Xenova/all-MiniLM-L6-v2")).toBeInTheDocument();
  });

  it("shows the pinned revision, which is what makes output reproducible", () => {
    render(<ModelList models={[model()]} />);

    expect(screen.getByText("751bff37182d")).toBeInTheDocument();
  });

  it("shows disk use in units a person reads", () => {
    render(<ModelList models={[model()]} />);

    expect(screen.getByText("23.0 MB")).toBeInTheDocument();
  });

  it("names each conformance outcome, so colour is not the only carrier", () => {
    render(<ModelList models={[model({ conformance: "passed" })]} />);

    expect(screen.getByText(/Passed its checks/)).toBeInTheDocument();
  });

  it("explains a failure rather than only reporting it", () => {
    render(
      <ModelList
        models={[model({ conformance: "failed", conformanceReason: "ordering probe" })]}
      />,
    );

    expect(screen.getByText(/ordering probe/)).toBeInTheDocument();
  });

  it("distinguishes a model in use from one merely installed", () => {
    render(<ModelList models={[model({ active: true })]} />);

    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("lists every installed model", () => {
    render(
      <ModelList
        models={[
          model(),
          model({ ref: "other", repository: "Xenova/bge-small-en-v1.5", revision: "e".repeat(40) }),
        ]}
      />,
    );

    expect(screen.getAllByTestId("model-list-item")).toHaveLength(2);
  });

  it("renders a model whose quantization is unknown without showing an empty separator", () => {
    render(<ModelList models={[model({ quantization: undefined })]} />);

    expect(screen.getByText("751bff37182d")).toBeInTheDocument();
    expect(screen.queryByText(/·\s*$/)).not.toBeInTheDocument();
  });

  it("carries a light and dark pair, so the surface follows the system scheme", () => {
    render(<ModelList models={[model()]} />);

    expect(screen.getByTestId("model-list-item").className).toMatch(/dark:/);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BenchmarkReport } from ".";
import { MINIMUM_CHUNKS_PER_SECOND } from "../../constants";
import type { ThroughputMeasurement } from "../../model/measureEmbeddingThroughput";

const measurement = (overrides: Partial<ThroughputMeasurement> = {}): ThroughputMeasurement => ({
  device: "wasm",
  chunkCount: 40,
  durationMs: 2_000,
  chunksPerSecond: 20,
  loadDurationMs: 1_500,
  meetsBudget: true,
  ...overrides,
});

describe("BenchmarkReport", () => {
  it("shows nothing before a measurement exists", () => {
    const { container } = render(<BenchmarkReport />);

    expect(container).toBeEmptyDOMElement();
  });

  it("says it is measuring while a run is in flight", () => {
    render(<BenchmarkReport running />);

    expect(screen.getByTestId("benchmark-running")).toBeInTheDocument();
  });

  it("reports throughput in the unit the budget is written in", () => {
    render(<BenchmarkReport measurement={measurement({ chunksPerSecond: 23.456 })} />);

    expect(screen.getByTestId("benchmark-report")).toHaveTextContent("23.5 chunks/s");
  });

  it("names the budget rather than only passing judgement", () => {
    render(<BenchmarkReport measurement={measurement()} />);

    expect(screen.getByTestId("benchmark-report")).toHaveTextContent(
      new RegExp(String(MINIMUM_CHUNKS_PER_SECOND)),
    );
  });

  it("says plainly when a measurement falls short", () => {
    render(
      <BenchmarkReport measurement={measurement({ chunksPerSecond: 3, meetsBudget: false })} />,
    );

    expect(screen.getByTestId("benchmark-report")).toHaveTextContent(/below the budget/);
  });

  it("shows the device, because the number means nothing without it", () => {
    render(<BenchmarkReport measurement={measurement({ device: "webgpu" })} />);

    expect(screen.getByTestId("benchmark-report")).toHaveTextContent("webgpu");
  });

  it("says single-threaded rather than showing a bare one", () => {
    render(<BenchmarkReport measurement={measurement()} threadCount={1} />);

    expect(screen.getByTestId("benchmark-report")).toHaveTextContent(/single-threaded/);
  });

  it("names a higher thread count when there is one", () => {
    render(<BenchmarkReport measurement={measurement()} threadCount={8} />);

    expect(screen.getByTestId("benchmark-report")).toHaveTextContent(/8 threads/);
  });

  it("omits the thread count when it is unknown", () => {
    render(<BenchmarkReport measurement={measurement()} />);

    expect(screen.getByTestId("benchmark-report")).not.toHaveTextContent(/thread/);
  });

  it("reports the batch it measured, so the figure can be checked", () => {
    render(<BenchmarkReport measurement={measurement()} />);

    expect(screen.getByTestId("benchmark-report")).toHaveTextContent("40 chunks in 2.00 s");
  });

  it("reports loading separately and says it is paid once", () => {
    render(<BenchmarkReport measurement={measurement({ loadDurationMs: 9_000 })} />);

    expect(screen.getByTestId("benchmark-report")).toHaveTextContent(/9\.00 s, paid once/);
  });

  it("carries a light and dark pair", () => {
    render(<BenchmarkReport measurement={measurement()} />);

    expect(screen.getByTestId("benchmark-report").className).toMatch(/dark:/);
  });
});

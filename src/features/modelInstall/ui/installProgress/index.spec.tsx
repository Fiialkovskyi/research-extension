import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InstallProgress } from ".";

const progress = {
  path: "onnx/model_quantized.onnx",
  completedFiles: 1,
  totalFiles: 5,
  completedBytes: 5_000_000,
  totalBytes: 20_000_000,
};

describe("InstallProgress", () => {
  it("shows nothing before an install is asked for", () => {
    const { container } = render(<InstallProgress state={{ status: "idle" }} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("reports how far the download has got", () => {
    render(<InstallProgress state={{ status: "running", progress }} />);

    expect(screen.getByTestId("install-running")).toHaveTextContent("25%");
  });

  it("names the file in flight, so a large transfer does not look stalled", () => {
    render(<InstallProgress state={{ status: "running", progress }} />);

    expect(screen.getByText("onnx/model_quantized.onnx")).toBeInTheDocument();
  });

  it("omits the file name on the final update, which names none", () => {
    render(
      <InstallProgress
        state={{ status: "running", progress: { ...progress, path: "", completedFiles: 5 } }}
      />,
    );

    expect(screen.getByTestId("install-running")).toHaveTextContent("Installing");
  });

  it("does not divide by zero before any size is known", () => {
    render(
      <InstallProgress
        state={{
          status: "running",
          progress: { ...progress, completedBytes: 0, totalBytes: 0 },
        }}
      />,
    );

    expect(screen.getByTestId("install-running")).toHaveTextContent("0%");
  });

  it("says an installed model is not yet usable, which is the truth", () => {
    render(<InstallProgress state={{ status: "installed", ref: "a@b", diskBytes: 1 }} />);

    expect(screen.getByTestId("install-installed")).toHaveTextContent(/pass its checks/);
  });

  it("shows the reason an install failed, not a generic message", () => {
    render(
      <InstallProgress
        state={{
          status: "failed",
          repository: "Xenova/all-MiniLM-L6-v2",
          reason: '"config.json" does not match its manifest',
        }}
      />,
    );

    expect(screen.getByTestId("install-failed")).toHaveTextContent(/does not match its manifest/);
  });

  it("names the repository that failed, so two installs are distinguishable", () => {
    render(
      <InstallProgress
        state={{ status: "failed", repository: "Xenova/bge-small-en-v1.5", reason: "refused" }}
      />,
    );

    expect(screen.getByTestId("install-failed")).toHaveTextContent("Xenova/bge-small-en-v1.5");
  });

  it("carries a light and dark pair in every reported state", () => {
    for (const [testId, element] of [
      ["install-running", <InstallProgress key="r" state={{ status: "running", progress }} />],
      [
        "install-installed",
        <InstallProgress key="i" state={{ status: "installed", ref: "a", diskBytes: 1 }} />,
      ],
      [
        "install-failed",
        <InstallProgress key="f" state={{ status: "failed", repository: "a", reason: "b" }} />,
      ],
    ] as const) {
      const { unmount } = render(element);

      expect(screen.getByTestId(testId).className).toMatch(/dark:/);
      unmount();
    }
  });
});

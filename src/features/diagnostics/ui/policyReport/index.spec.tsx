import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PolicyReport } from ".";

const permitted = ["https://huggingface.co", "https://*.hf.co"];

describe("PolicyReport", () => {
  it("shows nothing before the policy has been read", () => {
    const { container } = render(<PolicyReport />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows what the package declares it may reach", () => {
    render(<PolicyReport permittedOrigins={permitted} />);

    expect(screen.getByTestId("policy-report")).toHaveTextContent(
      "https://huggingface.co https://*.hf.co",
    );
  });

  it("states that nothing was blocked, rather than showing an absence", () => {
    // During this change an empty list is the evidence the allowlist suffices.
    render(<PolicyReport permittedOrigins={permitted} blocked={[]} />);

    expect(screen.getByTestId("policy-nothing-blocked")).toBeInTheDocument();
  });

  it("treats an unread refusal list the same as an empty one", () => {
    render(<PolicyReport permittedOrigins={permitted} />);

    expect(screen.getByTestId("policy-nothing-blocked")).toBeInTheDocument();
  });

  it("names each refused origin and the directive that refused it", () => {
    render(
      <PolicyReport
        permittedOrigins={permitted}
        blocked={[{ origin: "https://cdn.jsdelivr.net", directive: "connect-src" }]}
      />,
    );

    expect(screen.getByTestId("policy-blocked")).toHaveTextContent(
      /cdn\.jsdelivr\.net refused by connect-src/,
    );
  });

  it("lists every refusal", () => {
    render(
      <PolicyReport
        permittedOrigins={permitted}
        blocked={[
          { origin: "https://a.example", directive: "connect-src" },
          { origin: "https://b.example", directive: "script-src" },
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("carries a light and dark pair", () => {
    render(<PolicyReport permittedOrigins={permitted} />);

    expect(screen.getByTestId("policy-report").className).toMatch(/dark:/);
  });
});

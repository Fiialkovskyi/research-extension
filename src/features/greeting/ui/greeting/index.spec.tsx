import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Greeting } from "./index";

describe("Greeting", () => {
  it("renders the greeting message", () => {
    render(<Greeting />);

    expect(screen.getByTestId("greeting")).toHaveTextContent("Hello World");
  });
});

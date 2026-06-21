import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home page", () => {
  it("renders the getting-started heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /to get started/i }),
    ).toBeInTheDocument();
  });
});

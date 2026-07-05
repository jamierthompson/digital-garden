import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StudioProvider from "./StudioProvider";
import StudioCanvas from "./StudioCanvas";

/** The canvas reads shared state, so it only renders meaningfully inside the provider. */
function renderCanvas() {
  return render(
    <StudioProvider slug="demo">
      <StudioCanvas />
    </StudioProvider>,
  );
}

describe("StudioCanvas — prose-less composition", () => {
  it("mounts every studio surface once, in one grid, sharing provider state", () => {
    renderCanvas();
    // The seed input, the rules, the swatch cards, the glossary, and the export are all present.
    expect(screen.getByLabelText("Seed color")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Swatch cards" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Rules" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Export" })).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: /glossary/i }),
    ).toBeInTheDocument();
    // One derivation card grid (not the old primitives/receipt islands).
    expect(screen.getAllByRole("heading", { name: /^--/ }).length).toBe(14);
  });

  it("shares one seed store across surfaces — no MissingFrame placeholders", () => {
    renderCanvas();
    // Every surface is inside the provider, so none degrades to the no-frame placeholder.
    expect(screen.queryByText(/no studio frame/i)).not.toBeInTheDocument();
  });
});

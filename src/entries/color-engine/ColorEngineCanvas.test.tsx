import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BRAND_TOKEN_NAMES } from "@garden/oklch";

import ColorEngineProvider from "./ColorEngineProvider";
import ColorEngineCanvas from "./ColorEngineCanvas";

/** The canvas reads shared state, so it only renders meaningfully inside the provider. */
function renderCanvas() {
  return render(
    <ColorEngineProvider slug="demo">
      <ColorEngineCanvas />
    </ColorEngineProvider>,
  );
}

describe("ColorEngineCanvas — prose-less composition", () => {
  it("mounts every Color Engine surface once, in one grid, sharing provider state", () => {
    renderCanvas();
    // The seed input, the rules, the swatch cards, the glossary, and the export are all present.
    expect(screen.getByLabelText("Seed color")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Swatch cards" }),
    ).toBeInTheDocument();
    // The restored palette table — a companion region alongside the cards, not a replacement.
    expect(
      screen.getByRole("region", { name: "Palette table" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Rules" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Live preview" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Export" })).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: /glossary/i }),
    ).toBeInTheDocument();
    // One derivation card grid (not the old primitives/receipt islands) — one heading per token.
    expect(screen.getAllByRole("heading", { name: /^--/ }).length).toBe(
      BRAND_TOKEN_NAMES.length,
    );
  });

  it("shares one seed store across surfaces — no MissingFrame placeholders", () => {
    renderCanvas();
    // Every surface is inside the provider, so none degrades to the no-frame placeholder.
    expect(
      screen.queryByText(/no Color Engine frame/i),
    ).not.toBeInTheDocument();
  });
});

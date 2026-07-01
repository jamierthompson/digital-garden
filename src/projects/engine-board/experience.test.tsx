import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EngineBoardExperience from "./experience";

// The engine-board is a pure, sync, presentational Server Component reading only scoped CSS
// vars — so jsdom renders it directly (no async RSC, no font/Sanity deps). These tests pin
// the CONTRACT the board exists to prove: every emitted semantic + status token gets a chip
// keyed off `var(--<token>)`, so the board tracks the engine's output rather than an invented
// subset.

const SEMANTIC_TOKENS = [
  "bg",
  "surface",
  "surface-2",
  "border",
  "text",
  "text-muted",
  "accent",
  "accent-text",
  "on-accent",
  "focus-ring",
];
const STATUS_TOKENS = ["success", "error", "warning", "info"];

describe("EngineBoardExperience", () => {
  it("renders a labelled chip for every semantic and status token", () => {
    render(<EngineBoardExperience />);
    for (const token of [...SEMANTIC_TOKENS, ...STATUS_TOKENS]) {
      expect(screen.getByText(`--${token}`)).toBeInTheDocument();
    }
  });

  it("fills each chip from its live scoped `var(--<token>)`", () => {
    const { container } = render(<EngineBoardExperience />);
    // The accent chip's inline background reads the scoped accent token, not a hardcoded
    // color — this is what makes the board re-theme per brand scope.
    const accentLabel = screen.getByText("--accent");
    const swatch = accentLabel.closest("li");
    expect(swatch).not.toBeNull();
    const chip = (swatch as HTMLElement).querySelector("span");
    expect(chip).toHaveStyle({ background: "var(--accent)" });
    // Every token in the board is chip-backed — no fewer chips than declared tokens.
    const chips = container.querySelectorAll("li > span");
    expect(chips).toHaveLength(SEMANTIC_TOKENS.length + STATUS_TOKENS.length);
  });

  it("groups tokens under Semantic roles and Status signals headings", () => {
    render(<EngineBoardExperience />);
    expect(
      screen.getByRole("heading", { name: /semantic roles/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /status signals/i }),
    ).toBeInTheDocument();
  });
});

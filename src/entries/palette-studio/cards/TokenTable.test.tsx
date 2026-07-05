import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { derivePalette } from "../core/derive";
import { DEFAULT_RULES } from "../core/rules";
import { buildCards } from "./cardModel";
import TokenTable from "./TokenTable";

const cards = buildCards(derivePalette("#7c3aed", DEFAULT_RULES, "srgb"));

describe("TokenTable", () => {
  it("renders one row per token, auto-scaling to the contract's size", () => {
    render(<TokenTable cards={cards} scheme="light" />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(cards.length + 1); // + the header row
  });

  it("names every row with its semantic token name", () => {
    render(<TokenTable cards={cards} scheme="light" />);
    for (const card of cards) {
      expect(
        screen.getByRole("rowheader", { name: `--${card.name}` }),
      ).toBeInTheDocument();
    }
  });

  it("captions which scheme the table is showing", () => {
    const { rerender } = render(<TokenTable cards={cards} scheme="light" />);
    expect(screen.getByText(/showing the light scheme/i)).toBeInTheDocument();
    rerender(<TokenTable cards={cards} scheme="dark" />);
    expect(screen.getByText(/showing the dark scheme/i)).toBeInTheDocument();
  });

  it("marks a co-solved token (no ramp step) as 'solved', not a step coordinate", () => {
    render(<TokenTable cards={cards} scheme="light" />);
    // `accent` is a continuous co-solve — it has no (role, label) ramp step.
    expect(screen.getAllByText("solved").length).toBeGreaterThan(0);
  });

  it("prints a live contrast readout for a measured foreground token", () => {
    render(<TokenTable cards={cards} scheme="light" />);
    const textCard = cards.find((c) => c.name === "text");
    expect(textCard?.light.measured).not.toBeNull();
    // "4.5:1 · Lc 90"-shaped readout, ratio only asserted loosely (varies per seed).
    expect(screen.getAllByText(/:1 · Lc \d+/).length).toBeGreaterThan(0);
  });

  it("shows a dash for a surface token with no contrast receipt", () => {
    render(<TokenTable cards={cards} scheme="light" />);
    const bgCard = cards.find((c) => c.name === "bg");
    expect(bgCard?.light.measured).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

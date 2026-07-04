import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { derivePalette } from "../core/derive";
import { DEFAULT_RULES } from "../core/rules";
import { buildCards } from "./cardModel";
import SwatchGrid from "./SwatchGrid";

const cards = buildCards(derivePalette("#7c3aed", DEFAULT_RULES, "srgb"));

describe("SwatchGrid", () => {
  it("renders one list item per card, as an explicit list", () => {
    render(<SwatchGrid cards={cards} scheme="light" />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(cards.length);
  });

  it("titles every card with its semantic token name", () => {
    render(<SwatchGrid cards={cards} scheme="light" />);
    for (const card of cards) {
      expect(
        screen.getByRole("heading", { name: `--${card.name}` }),
      ).toBeInTheDocument();
    }
  });

  it("captions which scheme the card faces are showing", () => {
    const { rerender } = render(<SwatchGrid cards={cards} scheme="light" />);
    expect(screen.getByText(/showing the light scheme/i)).toBeInTheDocument();
    rerender(<SwatchGrid cards={cards} scheme="dark" />);
    expect(screen.getByText(/showing the dark scheme/i)).toBeInTheDocument();
  });
});

// QA #131 — Kicker contract: with `htmlFor` it must be a REAL label (native control
// association + click-to-focus), without it a plain span that can still anchor
// aria-labelledby via `id`. SeedRow leans on the first; RulesBoard on the second.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Kicker from "./Kicker";

describe("Kicker", () => {
  it("renders a native <label> wired to the control when htmlFor is set", () => {
    render(
      <>
        <Kicker htmlFor="seed-input">Seed color</Kicker>
        <input id="seed-input" />
      </>,
    );
    // The association is the contract: the input's accessible name is the kicker text.
    expect(screen.getByLabelText("Seed color")).toBeInTheDocument();
    expect(screen.getByText("Seed color").tagName).toBe("LABEL");
  });

  it("renders a span carrying the id when used as an aria-labelledby anchor", () => {
    render(<Kicker id="rules-label">Rules</Kicker>);
    const el = screen.getByText("Rules");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveAttribute("id", "rules-label");
  });
});

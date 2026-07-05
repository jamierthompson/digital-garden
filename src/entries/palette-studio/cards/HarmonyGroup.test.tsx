import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HARMONY_HUES } from "@garden/oklch";

import StudioProvider from "../StudioProvider";
import HarmonyGroup from "./HarmonyGroup";

function renderGroup() {
  return render(
    <StudioProvider slug="demo">
      <HarmonyGroup />
    </StudioProvider>,
  );
}

describe("HarmonyGroup — decorative, clearly separated", () => {
  it("renders one card per derived harmony hue", () => {
    renderGroup();
    const region = screen.getByRole("region", { name: "Decorative harmony" });
    expect(within(region).getAllByRole("listitem")).toHaveLength(
      HARMONY_HUES.length,
    );
  });

  it("frames the group as decorative and NOT part of the token contract", () => {
    renderGroup();
    const region = screen.getByRole("region", { name: "Decorative harmony" });
    expect(
      within(region).getByText(/not part of the token contract/i),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(/charts, gradients, and secondary accents/i),
    ).toBeInTheDocument();
  });

  it("shows each hue's relationship, offset, and receipt-backed picks", () => {
    renderGroup();
    const region = screen.getByRole("region", { name: "Decorative harmony" });
    // The relationships (exact strings — "complementary" ≠ "split-complementary"): analogous
    // ×2, complementary ×1, split-complementary ×2, triadic ×2.
    expect(within(region).getAllByText("analogous")).toHaveLength(2);
    expect(within(region).getAllByText("complementary")).toHaveLength(1);
    expect(within(region).getAllByText("split-complementary")).toHaveLength(2);
    // The complementary hue's signed offset, and the graded picks' bound steps.
    expect(within(region).getByText("+180°")).toBeInTheDocument();
    expect(within(region).getAllByText(/step \d/i).length).toBeGreaterThan(0);
    // Plain-language gloss so the color-theory terms aren't unexplained jargon.
    expect(
      within(region).getByText(/the opposite on the color wheel/i),
    ).toBeInTheDocument();
    expect(
      within(region).getAllByText(/a neighbor on the color wheel/i),
    ).toHaveLength(2);
  });
});

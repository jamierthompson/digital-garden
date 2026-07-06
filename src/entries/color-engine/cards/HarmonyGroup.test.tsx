import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HARMONY_HUES } from "@garden/oklch";

import ColorEngineProvider from "../ColorEngineProvider";
import HarmonyGroup from "./HarmonyGroup";

function renderGroup() {
  return render(
    <ColorEngineProvider slug="demo">
      <HarmonyGroup />
    </ColorEngineProvider>,
  );
}

describe("HarmonyGroup — a clearly separated region", () => {
  it("renders one card per derived harmony hue", () => {
    renderGroup();
    const region = screen.getByRole("region", { name: "Harmony hues" });
    expect(within(region).getAllByRole("listitem")).toHaveLength(
      HARMONY_HUES.length,
    );
  });

  it("carries no prose blurb — the 'Harmony hues' region label names it (owner authors copy separately)", () => {
    renderGroup();
    const region = screen.getByRole("region", { name: "Harmony hues" });
    expect(
      within(region).queryByText(
        /two safe picks|check the contrast|built from your seed/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("shows each hue's relationship, offset, and receipt-backed picks", () => {
    renderGroup();
    const region = screen.getByRole("region", { name: "Harmony hues" });
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

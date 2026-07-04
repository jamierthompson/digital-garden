import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BindingStep } from "@garden/oklch";

import { derivePalette } from "../core/derive";
import { DEFAULT_RULES } from "../core/rules";
import MiniRamp from "./MiniRamp";

const palette = derivePalette("#7c3aed", DEFAULT_RULES, "srgb");
const neutral = palette.light.ramps.neutral;
const bound: BindingStep = { role: "neutral", label: "800" };

describe("MiniRamp", () => {
  it("renders all 11 steps as a labelled group naming the bound step", () => {
    render(<MiniRamp ramp={neutral} boundStep={bound} tokenName="text" />);
    const group = screen.getByRole("group", {
      name: /neutral ramp .*binds to step 800/i,
    });
    // 11 steps, each an aria-labelled span.
    expect(within(group).getAllByLabelText(/^neutral /)).toHaveLength(11);
  });

  it("marks exactly the bound step with aria-current", () => {
    render(<MiniRamp ramp={neutral} boundStep={bound} tokenName="text" />);
    const current = screen.getByLabelText(/neutral 800 — bound/i);
    expect(current).toHaveAttribute("aria-current", "true");
    // No other step is current.
    const group = screen.getByRole("group");
    const marked = within(group)
      .getAllByLabelText(/^neutral /)
      .filter((el) => el.getAttribute("aria-current") === "true");
    expect(marked).toHaveLength(1);
  });
});

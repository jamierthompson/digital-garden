import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BindingStep } from "@garden/oklch";

import { derivePalette } from "../core/derive";
import { DEFAULT_RULES } from "../core/rules";
import MiniRamp from "./MiniRamp";

const palette = derivePalette("#7c3aed", DEFAULT_RULES, "srgb");
const neutral = palette.light.ramps.neutral;
const bound: BindingStep = { role: "neutral", label: "800" };

describe("MiniRamp — self-explaining", () => {
  it("captions what the strip is and which shade this token is", () => {
    render(<MiniRamp ramp={neutral} boundStep={bound} tokenName="text" />);
    expect(
      screen.getByText(/the neutral scale — 11 shades/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/this token is the 800 shade/i),
    ).toBeInTheDocument();
  });

  it("renders all 11 shades as focusable buttons and marks the bound one", () => {
    render(<MiniRamp ramp={neutral} boundStep={bound} tokenName="text" />);
    const group = screen.getByRole("group", { name: /neutral scale/i });
    const steps = within(group).getAllByRole("button");
    expect(steps).toHaveLength(11);
    const current = within(group).getByLabelText(/shade 800 .*this token/i);
    expect(current).toHaveAttribute("aria-current", "true");
    const marked = steps.filter(
      (el) => el.getAttribute("aria-current") === "true",
    );
    expect(marked).toHaveLength(1);
  });

  it("defaults the readout to the bound shade", () => {
    render(<MiniRamp ramp={neutral} boundStep={bound} tokenName="text" />);
    expect(screen.getByText(/shade 800/i)).toBeInTheDocument();
    expect(screen.getByText(/· this token/i)).toBeInTheDocument();
  });
});

describe("MiniRamp — interactive", () => {
  it("updates the readout when a shade is hovered", () => {
    render(<MiniRamp ramp={neutral} boundStep={bound} tokenName="text" />);
    const fiftyBtn = screen.getByLabelText(/shade 50 of the neutral scale/i);
    fireEvent.mouseEnter(fiftyBtn);
    // The readout now describes shade 50 (a distinct oklch value from the bound 800).
    const readouts = screen.getAllByText(/shade 50/i);
    expect(readouts.length).toBeGreaterThan(0);
  });

  it("is a roving-tabindex group — only the active shade is tabbable", () => {
    render(<MiniRamp ramp={neutral} boundStep={bound} tokenName="text" />);
    const group = screen.getByRole("group", { name: /neutral scale/i });
    const tabbable = within(group)
      .getAllByRole("button")
      .filter((el) => el.getAttribute("tabindex") === "0");
    // Exactly one tab stop, and it starts on the bound shade.
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAttribute("aria-current", "true");
  });

  it("moves the active shade with arrow keys", () => {
    render(<MiniRamp ramp={neutral} boundStep={bound} tokenName="text" />);
    const group = screen.getByRole("group", { name: /neutral scale/i });
    // 800 is index 8; ArrowRight → 900.
    fireEvent.keyDown(group, { key: "ArrowRight" });
    const tabbable = within(group)
      .getAllByRole("button")
      .find((el) => el.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveAccessibleName(/shade 900/i);
  });

  it("re-homes the readout on the new bound shade when the scheme re-binds it", () => {
    // The bug this guards: the scheme resolving after the first render re-binds the token to a
    // new shade; the readout must follow, not keep the stale initial shade.
    const { rerender } = render(
      <MiniRamp ramp={neutral} boundStep={bound} tokenName="text" />,
    );
    expect(screen.getByText(/shade 800/i)).toBeInTheDocument();
    rerender(
      <MiniRamp
        ramp={neutral}
        boundStep={{ role: "neutral", label: "300" }}
        tokenName="text"
      />,
    );
    // Readout now shows 300 (the new bound), and 800 is no longer the readout's shade.
    const readout = screen.getByText(/shade 300/i);
    expect(readout).toBeInTheDocument();
    expect(readout.textContent).not.toMatch(/shade 800/i);
  });
});

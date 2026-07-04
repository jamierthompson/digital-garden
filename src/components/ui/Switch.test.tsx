// QA #131 — Switch contract: a real switch role, labelled via EITHER aria-label or an
// external labeller (aria-labelledby), keyboard-activatable, controlled. RulesBoard wires
// the tinted-neutrals toggle through `labelledBy`, so that path must hold.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Switch from "./Switch";

describe("Switch", () => {
  it("renders role=switch with aria-checked reflecting the controlled state", () => {
    const { rerender } = render(
      <Switch checked={false} onCheckedChange={() => {}} label="Tinted" />,
    );
    expect(screen.getByRole("switch", { name: "Tinted" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    rerender(
      <Switch checked={true} onCheckedChange={() => {}} label="Tinted" />,
    );
    expect(screen.getByRole("switch", { name: "Tinted" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("takes its accessible name from an external labeller via labelledBy", () => {
    render(
      <>
        <span id="tinted-label">Tinted neutrals</span>
        <Switch
          checked={true}
          onCheckedChange={() => {}}
          labelledBy="tinted-label"
        />
      </>,
    );
    expect(
      screen.getByRole("switch", { name: "Tinted neutrals" }),
    ).toBeInTheDocument();
  });

  it("reports the flipped value on click (controlled semantics)", () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch checked={false} onCheckedChange={onCheckedChange} label="T" />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "T" }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("does not flip itself — state stays with the owner (controlled)", () => {
    render(<Switch checked={false} onCheckedChange={() => {}} label="T" />);
    const el = screen.getByRole("switch", { name: "T" });
    fireEvent.click(el);
    // No re-render with a new prop happened, so the DOM must still read unchecked.
    expect(el).toHaveAttribute("aria-checked", "false");
  });
});

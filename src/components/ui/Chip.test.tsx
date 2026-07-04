// QA #131 — Chip contract: a toggle BUTTON (aria-pressed), never a submit, with the
// swatch hidden from the accessibility tree. These are the promises the studio's preset
// picker (SeedRow) and any future filter chips rely on.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Chip from "./Chip";

describe("Chip", () => {
  it("renders a type=button (no implicit form submission)", () => {
    render(
      <Chip pressed={false} onClick={() => {}}>
        Ocean
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "Ocean" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("exposes its toggle state as aria-pressed", () => {
    const { rerender } = render(
      <Chip pressed={false} onClick={() => {}}>
        Ocean
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "Ocean" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    rerender(
      <Chip pressed={true} onClick={() => {}}>
        Ocean
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "Ocean" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("fires onClick when activated", () => {
    const onClick = vi.fn();
    render(
      <Chip pressed={false} onClick={onClick}>
        Ocean
      </Chip>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("hides the swatch from assistive tech and keeps the accessible name the text", () => {
    render(
      <Chip pressed={false} onClick={() => {}} swatch="#00b3a4">
        Ocean
      </Chip>,
    );
    // The accessible name must be the label alone — the decorative swatch contributes
    // nothing (it is aria-hidden).
    const button = screen.getByRole("button", { name: "Ocean" });
    const swatch = button.querySelector('[aria-hidden="true"]');
    expect(swatch).not.toBeNull();
  });

  it("renders no swatch element when none is given", () => {
    render(
      <Chip pressed={false} onClick={() => {}}>
        Plain
      </Chip>,
    );
    const button = screen.getByRole("button", { name: "Plain" });
    expect(button.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});

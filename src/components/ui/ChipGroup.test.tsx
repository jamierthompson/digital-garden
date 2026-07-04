// QA #131 lineage (rewritten from Chip.test when the preset picker moved to Radix
// ToggleGroup): the single-select chip-group contract the studio's preset picker — and
// any future filter chips — rely on. Radix single-type emits radiogroup/radio +
// aria-checked (verified against the installed @radix-ui/react-toggle-group source).

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ChipGroup from "./ChipGroup";

const OPTIONS = [
  { value: "#00b3a4", label: "Ocean", swatch: "#00b3a4" },
  { value: "#eab308", label: "Solar", swatch: "#eab308" },
  { value: "plain", label: "Plain" },
] as const;

function renderGroup(
  value = "",
  onValueChange: (v: string) => void = () => {},
) {
  return render(
    <ChipGroup
      label="Preset seeds"
      value={value}
      onValueChange={onValueChange}
      options={OPTIONS}
    />,
  );
}

describe("ChipGroup", () => {
  it("is a labelled radiogroup of radio chips (Radix single-type semantics)", () => {
    renderGroup("#00b3a4");
    const group = screen.getByRole("radiogroup", { name: "Preset seeds" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Ocean" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Solar" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("selects on click and reports the picked value", () => {
    const onValueChange = vi.fn();
    renderGroup("", onValueChange);
    fireEvent.click(screen.getByRole("radio", { name: "Solar" }));
    expect(onValueChange).toHaveBeenCalledWith("#eab308");
  });

  it("reports '' when the active chip is clicked again (deselect is the caller's call)", () => {
    const onValueChange = vi.fn();
    renderGroup("#eab308", onValueChange);
    fireEvent.click(screen.getByRole("radio", { name: "Solar" }));
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("supports an empty selection — no chip checked", () => {
    renderGroup("");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-checked", "false");
    }
  });

  it("hides the swatch from assistive tech; the accessible name is the label alone", () => {
    renderGroup();
    const ocean = screen.getByRole("radio", { name: "Ocean" });
    expect(ocean.querySelector('[aria-hidden="true"]')).not.toBeNull();
    const plain = screen.getByRole("radio", { name: "Plain" });
    expect(plain.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("renders type=button items (no implicit form submission)", () => {
    renderGroup();
    expect(screen.getByRole("radio", { name: "Ocean" })).toHaveAttribute(
      "type",
      "button",
    );
  });
});

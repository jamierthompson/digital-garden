import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatOklch } from "@garden/oklch";

import { derivePalette } from "../core/derive";
import { DEFAULT_GAMUT, DEFAULT_RULES } from "../core/rules";
import PreviewCard from "./PreviewCard";

describe("PreviewCard", () => {
  it("scopes the generated tokens inline so specimens paint them, not the ambient theme", () => {
    const { light } = derivePalette("#7c3aed", DEFAULT_RULES, DEFAULT_GAMUT);
    render(<PreviewCard scheme="light" tokens={light.tokens} />);
    const panel = screen.getByRole("group", { name: "light preview" });
    // The container re-binds the semantic tokens to the GENERATED values — the specimens read
    // these via var(), never re-deriving color.
    expect(panel.style.getPropertyValue("--accent")).toBe(
      formatOklch(light.tokens.accent),
    );
    expect(panel.style.getPropertyValue("--surface")).toBe(
      formatOklch(light.tokens.surface),
    );
    expect(panel.style.getPropertyValue("--focus-ring-color")).toBe(
      formatOklch(light.tokens["focus-ring"]),
    );
    expect(panel.style.colorScheme).toBe("light");
  });

  it("re-scopes when the tokens change (live re-theme)", () => {
    const first = derivePalette("#7c3aed", DEFAULT_RULES, DEFAULT_GAMUT).light;
    const { rerender } = render(
      <PreviewCard scheme="light" tokens={first.tokens} />,
    );
    const before = screen
      .getByRole("group", { name: "light preview" })
      .style.getPropertyValue("--accent");
    const second = derivePalette("#eab308", DEFAULT_RULES, DEFAULT_GAMUT).light;
    rerender(<PreviewCard scheme="light" tokens={second.tokens} />);
    const after = screen
      .getByRole("group", { name: "light preview" })
      .style.getPropertyValue("--accent");
    expect(after).not.toBe(before);
  });
});

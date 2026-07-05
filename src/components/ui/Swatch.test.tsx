import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Swatch from "./Swatch";

describe("Swatch", () => {
  it("is decorative (aria-hidden) and fills the given color", () => {
    const { container } = render(<Swatch color="oklch(0.5 0.1 280)" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("aria-hidden", "true");
    // The fill child carries the color inline.
    const fill = root.firstElementChild as HTMLElement;
    expect(fill.style.background).toContain("oklch(0.5 0.1 280)");
  });

  it("adds the out-of-gamut marker only when oog is set", () => {
    const { container: plain } = render(<Swatch color="red" />);
    expect(plain.firstElementChild!.children).toHaveLength(1);

    const { container: flagged } = render(<Swatch color="red" oog />);
    expect(flagged.firstElementChild!.children).toHaveLength(2);
  });
});
